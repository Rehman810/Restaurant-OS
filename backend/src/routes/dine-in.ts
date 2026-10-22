import crypto from "crypto";
import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import {
  ReservationStatus,
  Role,
  SeatType,
  TableStatus,
  WaitlistStatus,
} from "@prisma/client";
import { prisma } from "../lib/prisma";
import { branchScopeError, resolveBranchScope } from "../lib/branch-scope";
import { ADMIN_LIKE, ORDER_OPS } from "../lib/roles";
import { requireAuth, requireRole } from "../middleware/auth";
import { branchDayRangeUtc, branchListRangeUtc } from "../lib/dine-in/branch-time";
import { branchHasCapacity } from "../lib/dine-in/availability";
import { displayToLegacyStatus, resolveDisplayStatus } from "../lib/dine-in/display-status";
import { assertReservationTransition } from "../lib/dine-in/reservation-machine";
import { normalizeGuestEmail, normalizeGuestPhone } from "../lib/dine-in/validation";
import { seatGuests, assertTableAssignable } from "../lib/dine-in/seat-guests";
import { closeTableSession } from "../lib/dine-in/close-session";
import { writeAuditLog } from "../lib/dine-in/audit";
import { enqueueForReservation, reservationEmailSummary, resendEmailLog } from "../lib/dine-in/email-queue";
import { loadBranchHours, listAvailableSlotStarts } from "../lib/dine-in/slots";
import { isKitchenOpen } from "../lib/hours";
import {
  branchQueueDate,
  listWaitlistForBranch,
  nextQueueNumber,
  seatTypeLabel,
} from "../lib/dine-in/waitlist";

import { requireEntitlement } from "../lib/platform/entitlement-middleware";

export const dineInRouter = Router();
dineInRouter.use((req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  return requireEntitlement("dineIn")(req, res, next);
});
export const dineInPublicRouter = Router();

const FLOOR_ROLES = [...ADMIN_LIKE, Role.CASHIER, Role.WAITER];
const BOOKING_HORIZON_MS = 60 * 24 * 60 * 60_000;

const publicBookingLimiter = rateLimit({
  windowMs: 10 * 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = normalizeGuestEmail((req.body as { guestEmail?: string })?.guestEmail) || "";
    return `${ipKeyGenerator(req.ip ?? "")}:${email}`;
  },
  message: { error: "Too many booking attempts. Please try again later." },
});

async function requireBranchId(req: import("express").Request) {
  const scope = await resolveBranchScope(req);
  if (scope.allBranches || !scope.branchId) {
    throw Object.assign(new Error("Select a single branch in the header to manage dine-in."), { status: 400 });
  }
  return scope.branchId;
}

function serializeSession(
  session: {
    id: string;
    guestName: string;
    partySize: number;
    openedAt: Date;
    waiter: { id: string; name: string } | null;
    orders: { total: { toString(): string }; status: string }[];
  } | null
) {
  if (!session) return null;
  const openTotal = session.orders
    .filter((o) => o.status !== "CANCELLED")
    .reduce((sum, o) => sum + Number(o.total), 0);
  return {
    id: session.id,
    guestName: session.guestName,
    partySize: session.partySize,
    openedAt: session.openedAt.toISOString(),
    waiter: session.waiter,
    orderCount: session.orders.length,
    runningTotal: openTotal,
  };
}

async function serializeReservation(r: {
  id: string;
  branchId: string;
  tableId: string | null;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  emailMissingLegacy: boolean;
  partySize: number;
  startsAt: Date;
  durationMin: number;
  status: ReservationStatus;
  notes: string | null;
  createdAt: Date;
  confirmedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  noShowAt: Date | null;
  cancelledAt: Date | null;
  table: { id: string; label: string } | null;
}) {
  const email = await reservationEmailSummary(r.id);
  return {
    ...r,
    startsAt: r.startsAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
    confirmedAt: r.confirmedAt?.toISOString() ?? null,
    rejectedAt: r.rejectedAt?.toISOString() ?? null,
    noShowAt: r.noShowAt?.toISOString() ?? null,
    cancelledAt: r.cancelledAt?.toISOString() ?? null,
    reservedAt: r.startsAt.toISOString(),
    customerName: r.guestName,
    customerPhone: r.guestPhone,
    customerEmail: r.emailMissingLegacy ? null : r.guestEmail,
    email,
  };
}

async function loadOverlapData(branchId: string) {
  const [reservations, sessions, tables] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        branchId,
        status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.SEATED] },
      },
    }),
    prisma.tableSession.findMany({ where: { branchId } }),
    prisma.diningTable.findMany({ where: { branchId }, select: { id: true, capacity: true } }),
  ]);
  return { reservations, sessions, tables };
}

// --- Public ---

dineInPublicRouter.get("/availability", async (req, res) => {
  const branchId = String(req.query.branchId || "");
  const partySize = Math.max(1, Number(req.query.partySize) || 2);
  const date = String(req.query.date || "");
  if (!branchId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "branchId and date (YYYY-MM-DD) are required." });
  }
  const branch = await prisma.branch.findFirst({ where: { id: branchId, isActive: true } });
  if (!branch) return res.status(404).json({ error: "Branch not found." });

  const hours = await loadBranchHours(branchId);
  const tables = await prisma.diningTable.findMany({ where: { branchId }, select: { id: true, capacity: true } });
  const caps = tables.map((t) => t.capacity);
  const slotStarts = listAvailableSlotStarts(date, hours.timezone, hours.schedule, hours.forceClosed, partySize, caps, new Date());
  const { reservations, sessions } = await loadOverlapData(branchId);
  const durationMin = 90;
  const available = slotStarts.filter((iso) => {
    const startsAt = new Date(iso);
    return branchHasCapacity(
      tables,
      partySize,
      startsAt,
      durationMin,
      reservations.map((r) => ({
        id: r.id,
        tableId: r.tableId,
        startsAt: r.startsAt,
        durationMin: r.durationMin,
        status: r.status,
      })),
      sessions.map((s) => ({
        tableId: s.tableId,
        openedAt: s.openedAt,
        closedAt: s.closedAt,
        status: s.status,
      }))
    );
  });
  res.json({ slots: available });
});

dineInPublicRouter.post("/reservations", publicBookingLimiter, async (req, res) => {
  const body = req.body as {
    branchId?: string;
    guestName?: string;
    guestEmail?: string;
    guestPhone?: string;
    partySize?: number;
    startsAt?: string;
    notes?: string;
    idempotencyKey?: string;
    website?: string;
  };
  if (body.website) return res.status(400).json({ error: "Invalid submission." });

  const guestEmail = normalizeGuestEmail(body.guestEmail);
  const guestPhone = normalizeGuestPhone(body.guestPhone);
  if (!body.branchId || !body.guestName?.trim() || !guestEmail) {
    return res.status(400).json({ error: "Branch, name, and a valid email are required." });
  }
  if (!guestPhone) return res.status(400).json({ error: "A valid Pakistan mobile number is required." });
  if (!body.startsAt) return res.status(400).json({ error: "startsAt is required." });

  const when = new Date(body.startsAt);
  if (Number.isNaN(when.getTime()) || when < new Date()) {
    return res.status(400).json({ error: "Choose a future date and time." });
  }
  if (when.getTime() > Date.now() + BOOKING_HORIZON_MS) {
    return res.status(400).json({ error: "Bookings are only available within 60 days." });
  }

  if (body.idempotencyKey) {
    const existing = await prisma.reservation.findFirst({ where: { idempotencyKey: body.idempotencyKey } });
    if (existing) {
      return res.status(200).json({ reservation: await serializeReservation({ ...existing, table: null }) });
    }
  }

  const branch = await prisma.branch.findFirst({ where: { id: body.branchId, isActive: true } });
  if (!branch) return res.status(404).json({ error: "Branch not found." });

  const hours = await loadBranchHours(branch.id);
  const schedule = hours.schedule;
  const { timezone } = hours;
  if (!isKitchenOpen({ forceClosed: false, timezone, schedule }, when)) {
    return res.status(409).json({ error: "Selected time is outside opening hours." });
  }

  const partySize = Math.max(1, Number(body.partySize) || 2);
  const { reservations, sessions, tables } = await loadOverlapData(branch.id);
  const maxCap = tables.reduce((m, t) => Math.max(m, t.capacity), 0);
  if (partySize > maxCap) {
    return res.status(409).json({ error: "No table large enough for this party at this branch." });
  }
  if (
    !branchHasCapacity(
      tables,
      partySize,
      when,
      90,
      reservations.map((r) => ({
        id: r.id,
        tableId: r.tableId,
        startsAt: r.startsAt,
        durationMin: r.durationMin,
        status: r.status,
      })),
      sessions.map((s) => ({
        tableId: s.tableId,
        openedAt: s.openedAt,
        closedAt: s.closedAt,
        status: s.status,
      }))
    )
  ) {
    return res.status(409).json({ error: "No tables available for that time. Try another slot." });
  }

  const reservation = await prisma.reservation.create({
    data: {
      branchId: branch.id,
      guestName: body.guestName.trim(),
      guestEmail,
      guestPhone,
      partySize,
      startsAt: when,
      notes: body.notes?.trim() || null,
      status: ReservationStatus.PENDING,
      confirmationToken: crypto.randomUUID(),
      idempotencyKey: body.idempotencyKey || null,
    },
  });

  void enqueueForReservation(reservation.id, "BOOKING_RECEIVED");
  void enqueueForReservation(reservation.id, "MANAGER_PENDING");
  void import("../lib/notifications/ops").then(({ notifyReservationPending }) => {
    notifyReservationPending({
      branchId: branch.id,
      reservationId: reservation.id,
      guestName: reservation.guestName,
      partySize: reservation.partySize,
      startsAt: reservation.startsAt.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: branch.timezone || "Asia/Karachi",
      }),
    });
  });

  res.status(201).json({
    reservation: await serializeReservation({ ...reservation, table: null }),
  });
});

dineInPublicRouter.post("/reservations/cancel", async (req, res) => {
  const token = String(req.query.token || (req.body as { token?: string })?.token || "");
  if (!token) return res.status(400).json({ error: "Token required." });
  const r = await prisma.reservation.findFirst({ where: { confirmationToken: token } });
  if (!r) return res.status(404).json({ error: "Booking not found." });
  if (r.status !== ReservationStatus.PENDING && r.status !== ReservationStatus.CONFIRMED) {
    return res.status(409).json({ error: "This booking can no longer be cancelled online." });
  }
  if (r.startsAt <= new Date()) {
    return res.status(409).json({ error: "Cannot cancel after the booking time." });
  }
  assertReservationTransition(r.status, ReservationStatus.CANCELLED);
  const updated = await prisma.reservation.update({
    where: { id: r.id },
    data: { status: ReservationStatus.CANCELLED, cancelledAt: new Date() },
  });
  void enqueueForReservation(r.id, "BOOKING_CANCELLED");
  res.json({ ok: true, reservation: await serializeReservation({ ...updated, table: null }) });
});

// --- Admin floors & floor map ---

dineInRouter.get("/floors", requireAuth, requireRole(...FLOOR_ROLES), async (req, res) => {
  try {
    const branchId = await requireBranchId(req);
    const floors = await prisma.diningFloor.findMany({
      where: { branchId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { tables: true } } },
    });
    res.json({
      floors: floors.map((f) => ({
        id: f.id,
        name: f.name,
        sortOrder: f.sortOrder,
        tableCount: f._count.tables,
      })),
    });
  } catch (err) {
    return branchScopeError(res, err);
  }
});

dineInRouter.post("/floors", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  try {
    const branchId = await requireBranchId(req);
    const { name, sortOrder } = req.body as { name?: string; sortOrder?: number };
    if (!name?.trim()) return res.status(400).json({ error: "Floor name is required." });
    const floor = await prisma.diningFloor.create({
      data: { branchId, name: name.trim(), sortOrder: Number(sortOrder) || 0 },
    });
    res.status(201).json({ floor });
  } catch (err) {
    if (typeof err === "object" && err && "code" in err && (err as { code: string }).code === "P2002") {
      return res.status(409).json({ error: "A floor with this name already exists at this branch." });
    }
    return branchScopeError(res, err);
  }
});

dineInRouter.patch("/floors/:id", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  try {
    const branchId = await requireBranchId(req);
    const { name, sortOrder } = req.body as { name?: string; sortOrder?: number };
    const floor = await prisma.diningFloor.findFirst({ where: { id: req.params.id, branchId } });
    if (!floor) return res.status(404).json({ error: "Floor not found." });
    const updated = await prisma.diningFloor.update({
      where: { id: floor.id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) || 0 } : {}),
      },
    });
    if (name) {
      await prisma.diningTable.updateMany({ where: { floorId: floor.id }, data: { zone: name.trim() } });
    }
    res.json({ floor: updated });
  } catch (err) {
    return branchScopeError(res, err);
  }
});

dineInRouter.delete("/floors/:id", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  try {
    const branchId = await requireBranchId(req);
    const floor = await prisma.diningFloor.findFirst({
      where: { id: req.params.id, branchId },
      include: { _count: { select: { tables: true } } },
    });
    if (!floor) return res.status(404).json({ error: "Floor not found." });
    if (floor._count.tables > 0) {
      return res.status(400).json({ error: "Remove or move all seats before deleting this floor." });
    }
    await prisma.diningFloor.delete({ where: { id: floor.id } });
    res.json({ ok: true });
  } catch (err) {
    return branchScopeError(res, err);
  }
});

dineInRouter.get("/floor", requireAuth, requireRole(...FLOOR_ROLES), async (req, res) => {
  try {
    const branchId = await requireBranchId(req);
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    const tz = branch?.timezone ?? "Asia/Karachi";
    const graceMin = branch?.graceMin ?? 15;
    const { startUtc, endUtc } = branchDayRangeUtc(tz);

    const [tables, waiters, floors, pendingCount, unassignedPage] = await Promise.all([
      prisma.diningTable.findMany({
        where: { branchId },
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
        include: {
          floor: { select: { id: true, name: true, sortOrder: true } },
          sessions: {
            where: { closedAt: null },
            take: 1,
            include: {
              waiter: { select: { id: true, name: true } },
              orders: { select: { total: true, status: true } },
            },
          },
          reservations: {
            where: {
              status: ReservationStatus.CONFIRMED,
              startsAt: { gte: new Date(Date.now() - 60 * 60_000) },
            },
          },
        },
      }),
      prisma.user.findMany({
        where: { role: Role.WAITER, isActive: true, branchMembers: { some: { branchId } } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.diningFloor.findMany({
        where: { branchId },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, sortOrder: true },
      }),
      prisma.reservation.count({ where: { branchId, status: ReservationStatus.PENDING } }),
      prisma.reservation.findMany({
        where: {
          branchId,
          tableId: null,
          status: ReservationStatus.CONFIRMED,
          startsAt: { gte: startUtc, lte: endUtc },
        },
        orderBy: { startsAt: "asc" },
        take: 50,
      }),
    ]);

    const now = new Date();
    res.json({
      floors,
      pendingBookingsCount: pendingCount,
      waitlistWaitingCount: await prisma.waitlistEntry.count({
        where: {
          branchId,
          queueDate: branchQueueDate(tz),
          status: { in: [WaitlistStatus.WAITING, WaitlistStatus.CALLED] },
        },
      }),
      branchTimezone: tz,
      graceMin,
      unassignedReservations: unassignedPage.map((r) => ({
        id: r.id,
        startsAt: r.startsAt.toISOString(),
        reservedAt: r.startsAt.toISOString(),
        partySize: r.partySize,
        customerName: r.guestName,
        guestName: r.guestName,
        status: r.status,
      })),
      tables: tables.map((t) => {
        const activeSession = serializeSession(t.sessions[0] ?? null);
        const display = resolveDisplayStatus(
          t.status,
          Boolean(activeSession),
          t.reservations.map((r) => ({ status: r.status, startsAt: r.startsAt })),
          now,
          graceMin
        );
        const legacy = displayToLegacyStatus(display);
        const next = t.reservations
          .filter((r) => r.status === ReservationStatus.CONFIRMED)
          .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0];
        const floorName = t.floor?.name ?? (t.zone?.trim() || "Main floor");
        return {
          id: t.id,
          label: t.label,
          capacity: t.capacity,
          seatType: t.seatType,
          zone: floorName,
          floorId: t.floorId,
          floor: t.floor,
          status: legacy,
          displayStatus: display,
          activeSession,
          nextReservation: next
            ? {
                id: next.id,
                reservedAt: next.startsAt.toISOString(),
                startsAt: next.startsAt.toISOString(),
                partySize: next.partySize,
                customerName: next.guestName,
                status: next.status,
              }
            : null,
        };
      }),
      waiters,
    });
  } catch (err) {
    return branchScopeError(res, err);
  }
});

// Tables CRUD (abbreviated - same as before)
dineInRouter.post("/tables", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  try {
    const branchId = await requireBranchId(req);
    const { label, capacity, floorId, seatType, sortOrder } = req.body as {
      label?: string;
      capacity?: number;
      floorId?: string;
      seatType?: SeatType;
      sortOrder?: number;
    };
    if (!label?.trim() || !floorId) return res.status(400).json({ error: "Label and floor are required." });
    const floor = await prisma.diningFloor.findFirst({ where: { id: floorId, branchId } });
    if (!floor) return res.status(400).json({ error: "Invalid floor." });
    const allowed: SeatType[] = [SeatType.TABLE, SeatType.TAKHT, SeatType.BOOTH, SeatType.HIGH_TOP, SeatType.OUTDOOR];
    const table = await prisma.diningTable.create({
      data: {
        branchId,
        floorId: floor.id,
        label: label.trim(),
        capacity: Math.max(1, Number(capacity) || 4),
        seatType: seatType && allowed.includes(seatType) ? seatType : SeatType.TABLE,
        zone: floor.name,
        sortOrder: Number(sortOrder) || 0,
      },
    });
    res.status(201).json({ table });
  } catch (err) {
    return branchScopeError(res, err);
  }
});

dineInRouter.delete("/tables/:id", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  try {
    const branchId = await requireBranchId(req);
    const existing = await prisma.diningTable.findFirst({ where: { id: req.params.id, branchId } });
    if (!existing) return res.status(404).json({ error: "Table not found." });
    const open = await prisma.tableSession.count({ where: { tableId: existing.id, closedAt: null } });
    if (open) return res.status(400).json({ error: "Close the open session before deleting this table." });
    await prisma.diningTable.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (err) {
    return branchScopeError(res, err);
  }
});

dineInRouter.post("/tables/:id/open", requireAuth, requireRole(...FLOOR_ROLES), async (req, res) => {
  try {
    const branchId = await requireBranchId(req);
    const body = req.body as {
      guestName?: string;
      partySize?: number;
      waiterId?: string;
      notes?: string;
      force?: boolean;
    };
    const result = await seatGuests({
      branchId,
      tableId: req.params.id,
      actorId: req.user!.id,
      guestName: body.guestName,
      partySize: body.partySize,
      waiterId: body.waiterId,
      notes: body.notes,
      force: body.force && ADMIN_LIKE.includes(req.user!.role),
    });
    const session = await prisma.tableSession.findUnique({
      where: { id: result.sessionId },
      include: {
        waiter: { select: { id: true, name: true } },
        orders: { select: { total: true, status: true } },
      },
    });
    res.status(201).json({ session: serializeSession(session) });
  } catch (err) {
    const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 500;
    const code = typeof err === "object" && err && "code" in err ? (err as { code: string }).code : undefined;
    return res.status(status).json({ error: err instanceof Error ? err.message : "Could not seat", code });
  }
});

dineInRouter.post("/reservations/:id/seat", requireAuth, requireRole(...FLOOR_ROLES), async (req, res) => {
  try {
    const branchId = await requireBranchId(req);
    const body = req.body as { tableId?: string; waiterId?: string; guestName?: string; partySize?: number };
    const reservation = await prisma.reservation.findFirst({ where: { id: req.params.id, branchId } });
    if (!reservation) return res.status(404).json({ error: "Reservation not found." });
    const tableId = body.tableId || reservation.tableId;
    if (!tableId) return res.status(400).json({ error: "tableId is required." });
    const result = await seatGuests({
      branchId,
      tableId,
      reservationId: reservation.id,
      actorId: req.user!.id,
      waiterId: body.waiterId,
      guestName: body.guestName,
      partySize: body.partySize,
    });
    const session = await prisma.tableSession.findUnique({
      where: { id: result.sessionId },
      include: { waiter: { select: { id: true, name: true } }, orders: { select: { total: true, status: true } } },
    });
    res.status(201).json({ session: serializeSession(session) });
  } catch (err) {
    const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 500;
    const code = typeof err === "object" && err && "code" in err ? (err as { code: string }).code : undefined;
    return res.status(status).json({ error: err instanceof Error ? err.message : "Could not seat", code });
  }
});

dineInRouter.post("/sessions/:id/close", requireAuth, requireRole(...FLOOR_ROLES), async (req, res) => {
  try {
    const branchId = await requireBranchId(req);
    const body = req.body as { force?: boolean; reason?: string };
    const force = Boolean(body.force) && ADMIN_LIKE.includes(req.user!.role);
    await closeTableSession({
      sessionId: req.params.id,
      branchId,
      actorId: req.user!.id,
      force,
      forceReason: body.reason,
    });
    res.json({ ok: true });
  } catch (err) {
    const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 500;
    return res.status(status).json({ error: err instanceof Error ? err.message : "Could not close" });
  }
});

dineInRouter.post("/tables/:id/clean", requireAuth, requireRole(...FLOOR_ROLES), async (req, res) => {
  try {
    const branchId = await requireBranchId(req);
    const table = await prisma.diningTable.findFirst({ where: { id: req.params.id, branchId } });
    if (!table) return res.status(404).json({ error: "Table not found." });
    const open = await prisma.tableSession.count({ where: { tableId: table.id, closedAt: null } });
    if (open) return res.status(400).json({ error: "Close the session before marking clean." });
    await prisma.diningTable.update({ where: { id: table.id }, data: { status: TableStatus.AVAILABLE } });
    res.json({ ok: true });
  } catch (err) {
    return branchScopeError(res, err);
  }
});

dineInRouter.get("/reservations", requireAuth, requireRole(...ADMIN_LIKE, ...ORDER_OPS), async (req, res) => {
  try {
    const branchId = await requireBranchId(req);
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    const tz = branch?.timezone ?? "Asia/Karachi";
    const history = req.query.history === "true";
    const { from, to } = branchListRangeUtc(tz);
    const statusFilter = history
      ? { in: [ReservationStatus.SEATED, ReservationStatus.COMPLETED, ReservationStatus.CANCELLED, ReservationStatus.REJECTED, ReservationStatus.NO_SHOW] }
      : { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] };

    const reservations = await prisma.reservation.findMany({
      where: { branchId, startsAt: { gte: from, lte: to }, status: statusFilter },
      orderBy: { startsAt: "asc" },
      include: { table: { select: { id: true, label: true } } },
    });
    res.json({ reservations: await Promise.all(reservations.map((r) => serializeReservation(r))) });
  } catch (err) {
    return branchScopeError(res, err);
  }
});

dineInRouter.post("/reservations", requireAuth, requireRole(...ADMIN_LIKE, ...ORDER_OPS), async (req, res) => {
  try {
    const branchId = await requireBranchId(req);
    const body = req.body as {
      guestName?: string;
      customerName?: string;
      guestEmail?: string;
      customerEmail?: string;
      guestPhone?: string;
      customerPhone?: string;
      partySize?: number;
      startsAt?: string;
      reservedAt?: string;
      notes?: string;
      tableId?: string;
    };
    const guestEmail = normalizeGuestEmail(body.guestEmail ?? body.customerEmail);
    const guestPhone = normalizeGuestPhone(body.guestPhone ?? body.customerPhone);
    const guestName = (body.guestName ?? body.customerName)?.trim();
    const startsAtRaw = body.startsAt ?? body.reservedAt;
    if (!guestName || !guestEmail || !guestPhone || !startsAtRaw) {
      return res.status(400).json({ error: "Name, valid email, phone, and date/time are required." });
    }
    const when = new Date(startsAtRaw);
    if (Number.isNaN(when.getTime())) return res.status(400).json({ error: "Invalid date/time." });

    if (body.tableId) {
      await assertTableAssignable(branchId, body.tableId, when, 90, Number(body.partySize) || 2);
    }

    const reservation = await prisma.reservation.create({
      data: {
        branchId,
        guestName,
        guestEmail,
        guestPhone,
        partySize: Math.max(1, Number(body.partySize) || 2),
        startsAt: when,
        notes: body.notes?.trim() || null,
        tableId: body.tableId || null,
        status: ReservationStatus.PENDING,
        confirmationToken: crypto.randomUUID(),
      },
      include: { table: { select: { id: true, label: true } } },
    });

    void enqueueForReservation(reservation.id, "BOOKING_RECEIVED");
    if (ADMIN_LIKE.includes(req.user!.role)) {
      // managers may confirm in a second step; cashiers always pending
    } else {
      void enqueueForReservation(reservation.id, "MANAGER_PENDING");
    }

    res.status(201).json({ reservation: await serializeReservation(reservation) });
  } catch (err) {
    const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 500;
    return res.status(status).json({ error: err instanceof Error ? err.message : "Could not create" });
  }
});

dineInRouter.post("/reservations/:id/confirm", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  try {
    const branchId = await requireBranchId(req);
    const { tableId } = req.body as { tableId?: string };
    const existing = await prisma.reservation.findFirst({ where: { id: req.params.id, branchId } });
    if (!existing) return res.status(404).json({ error: "Not found." });
    assertReservationTransition(existing.status, ReservationStatus.CONFIRMED);
    if (tableId) {
      await assertTableAssignable(branchId, tableId, existing.startsAt, existing.durationMin, existing.partySize, existing.id);
    }
    const reservation = await prisma.reservation.update({
      where: { id: existing.id },
      data: {
        status: ReservationStatus.CONFIRMED,
        confirmedAt: new Date(),
        confirmedById: req.user!.id,
        tableId: tableId ?? existing.tableId,
      },
      include: { table: { select: { id: true, label: true } } },
    });
    await writeAuditLog({
      branchId,
      actorId: req.user!.id,
      action: "reservation.confirm",
      entity: "Reservation",
      entityId: reservation.id,
    });
    void enqueueForReservation(reservation.id, "BOOKING_CONFIRMED");
    res.json({ reservation: await serializeReservation(reservation) });
  } catch (err) {
    const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 500;
    return res.status(status).json({ error: err instanceof Error ? err.message : "Could not confirm" });
  }
});

dineInRouter.post("/reservations/:id/reject", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  try {
    const branchId = await requireBranchId(req);
    const { reason } = req.body as { reason?: string };
    const existing = await prisma.reservation.findFirst({ where: { id: req.params.id, branchId } });
    if (!existing) return res.status(404).json({ error: "Not found." });
    assertReservationTransition(existing.status, ReservationStatus.REJECTED);
    const reservation = await prisma.reservation.update({
      where: { id: existing.id },
      data: {
        status: ReservationStatus.REJECTED,
        rejectedAt: new Date(),
        rejectionReason: reason?.trim() || null,
        tableId: null,
      },
      include: { table: { select: { id: true, label: true } } },
    });
    await writeAuditLog({
      branchId,
      actorId: req.user!.id,
      action: "reservation.reject",
      entity: "Reservation",
      entityId: reservation.id,
    });
    void enqueueForReservation(reservation.id, "BOOKING_REJECTED");
    res.json({ reservation: await serializeReservation(reservation) });
  } catch (err) {
    const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 500;
    return res.status(status).json({ error: err instanceof Error ? err.message : "Could not reject" });
  }
});

dineInRouter.post("/reservations/:id/no-show", requireAuth, requireRole(...FLOOR_ROLES), async (req, res) => {
  try {
    const branchId = await requireBranchId(req);
    const existing = await prisma.reservation.findFirst({ where: { id: req.params.id, branchId } });
    if (!existing) return res.status(404).json({ error: "Not found." });
    assertReservationTransition(existing.status, ReservationStatus.NO_SHOW);
    const reservation = await prisma.reservation.update({
      where: { id: existing.id },
      data: { status: ReservationStatus.NO_SHOW, noShowAt: new Date() },
      include: { table: { select: { id: true, label: true } } },
    });
    void enqueueForReservation(reservation.id, "BOOKING_NO_SHOW");
    res.json({ reservation: await serializeReservation(reservation) });
  } catch (err) {
    const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 500;
    return res.status(status).json({ error: err instanceof Error ? err.message : "Could not mark no-show" });
  }
});

dineInRouter.patch("/reservations/:id", requireAuth, requireRole(...ADMIN_LIKE, Role.CASHIER), async (req, res) => {
  try {
    const branchId = await requireBranchId(req);
    const existing = await prisma.reservation.findFirst({ where: { id: req.params.id, branchId } });
    if (!existing) return res.status(404).json({ error: "Not found." });
    const body = req.body as {
      status?: ReservationStatus;
      tableId?: string | null;
      startsAt?: string;
      partySize?: number;
      notes?: string;
    };
    if (body.status) assertReservationTransition(existing.status, body.status);
    const startsAt = body.startsAt ? new Date(body.startsAt) : existing.startsAt;
    const partySize = body.partySize !== undefined ? Math.max(1, Number(body.partySize) || 2) : existing.partySize;
    if (body.tableId) {
      await assertTableAssignable(branchId, body.tableId, startsAt, existing.durationMin, partySize, existing.id);
    }
    const reservation = await prisma.reservation.update({
      where: { id: existing.id },
      data: {
        ...(body.status ? { status: body.status, cancelledAt: body.status === ReservationStatus.CANCELLED ? new Date() : undefined } : {}),
        ...(body.tableId !== undefined ? { tableId: body.tableId } : {}),
        ...(body.startsAt ? { startsAt } : {}),
        ...(body.partySize !== undefined ? { partySize } : {}),
        ...(body.notes !== undefined ? { notes: body.notes?.trim() || null } : {}),
      },
      include: { table: { select: { id: true, label: true } } },
    });
    if (body.status === ReservationStatus.CANCELLED) {
      void enqueueForReservation(reservation.id, "BOOKING_CANCELLED");
    }
    res.json({ reservation: await serializeReservation(reservation) });
  } catch (err) {
    const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 500;
    return res.status(status).json({ error: err instanceof Error ? err.message : "Could not update" });
  }
});

dineInRouter.post("/reservations/:id/emails/:logId/resend", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  const ok = await resendEmailLog(req.params.logId);
  if (!ok) return res.status(404).json({ error: "Email log not found." });
  res.json({ ok: true });
});

dineInRouter.get("/waitlist", requireAuth, requireRole(...FLOOR_ROLES), async (req, res) => {
  try {
    const branchId = await requireBranchId(req);
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    const tz = branch?.timezone ?? "Asia/Karachi";
    const includeDone = req.query.history === "true";
    const data = await listWaitlistForBranch(branchId, tz, includeDone);
    res.json(data);
  } catch (err) {
    return branchScopeError(res, err);
  }
});

dineInRouter.post("/waitlist", requireAuth, requireRole(...FLOOR_ROLES), async (req, res) => {
  try {
    const branchId = await requireBranchId(req);
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    const tz = branch?.timezone ?? "Asia/Karachi";
    const body = req.body as {
      guestName?: string;
      guestPhone?: string;
      partySize?: number;
      preferredSeatType?: SeatType;
      preferredTableId?: string;
      notes?: string;
    };
    const guestName = (body.guestName || "").trim();
    if (!guestName) return res.status(400).json({ error: "Guest name is required." });
    const partySize = Math.min(30, Math.max(1, Number(body.partySize) || 2));
    const queueDate = branchQueueDate(tz);
    const queueNumber = await nextQueueNumber(branchId, queueDate);

    if (body.preferredTableId) {
      const table = await prisma.diningTable.findFirst({
        where: { id: body.preferredTableId, branchId },
      });
      if (!table) return res.status(400).json({ error: "Preferred table not found." });
      if (table.capacity < partySize) {
        return res.status(400).json({ error: `${table.label} only fits ${table.capacity} guests.` });
      }
    }

    const entry = await prisma.waitlistEntry.create({
      data: {
        branchId,
        queueDate,
        queueNumber,
        guestName,
        guestPhone: body.guestPhone?.trim() || null,
        partySize,
        preferredSeatType: body.preferredSeatType || null,
        preferredTableId: body.preferredTableId || null,
        notes: body.notes?.trim() || null,
      },
      include: { preferredTable: { select: { id: true, label: true, seatType: true } } },
    });

    await writeAuditLog({
      branchId,
      actorId: req.user!.id,
      action: "WAITLIST_ADD",
      entity: "WaitlistEntry",
      entityId: entry.id,
      meta: { queueNumber, partySize, preferredSeatType: body.preferredSeatType },
    });

    const listed = await listWaitlistForBranch(branchId, tz);
    const row = listed.entries.find((e) => e.id === entry.id);
    res.status(201).json({
      entry: row,
      message: `Queue number ${queueNumber}. ${seatTypeLabel(entry.preferredSeatType)}.`,
    });
  } catch (err) {
    return branchScopeError(res, err);
  }
});

dineInRouter.patch("/waitlist/:id", requireAuth, requireRole(...FLOOR_ROLES), async (req, res) => {
  try {
    const branchId = await requireBranchId(req);
    const body = req.body as { status?: WaitlistStatus; notes?: string };
    const existing = await prisma.waitlistEntry.findFirst({ where: { id: req.params.id, branchId } });
    if (!existing) return res.status(404).json({ error: "Waitlist entry not found." });

    const status = body.status;
    const data: {
      status?: WaitlistStatus;
      notes?: string | null;
      calledAt?: Date;
    } = {};
    if (body.notes !== undefined) data.notes = body.notes.trim() || null;
    if (status === WaitlistStatus.CALLED && existing.status === WaitlistStatus.WAITING) {
      data.status = WaitlistStatus.CALLED;
      data.calledAt = new Date();
    } else if (
      status === WaitlistStatus.CANCELLED ||
      status === WaitlistStatus.LEFT ||
      status === WaitlistStatus.WAITING
    ) {
      data.status = status;
    }

    const updated = await prisma.waitlistEntry.update({
      where: { id: existing.id },
      data,
      include: { preferredTable: { select: { id: true, label: true, seatType: true } } },
    });

    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    const listed = await listWaitlistForBranch(branchId, branch?.timezone ?? "Asia/Karachi");
    const row = listed.entries.find((e) => e.id === updated.id);
    res.json({ entry: row });
  } catch (err) {
    return branchScopeError(res, err);
  }
});

dineInRouter.post("/waitlist/:id/seat", requireAuth, requireRole(...FLOOR_ROLES), async (req, res) => {
  try {
    const branchId = await requireBranchId(req);
    const body = req.body as { tableId?: string; waiterId?: string; force?: boolean };
    const entry = await prisma.waitlistEntry.findFirst({ where: { id: req.params.id, branchId } });
    if (!entry) return res.status(404).json({ error: "Waitlist entry not found." });
    if (entry.status !== WaitlistStatus.WAITING && entry.status !== WaitlistStatus.CALLED) {
      return res.status(409).json({ error: "This party is no longer on the waitlist." });
    }
    const tableId = body.tableId || entry.preferredTableId;
    if (!tableId) return res.status(400).json({ error: "Choose a table or takht to seat this party." });

    const result = await seatGuests({
      branchId,
      tableId,
      actorId: req.user!.id,
      guestName: entry.guestName,
      partySize: entry.partySize,
      waiterId: body.waiterId,
      notes: entry.notes ?? undefined,
      force: body.force && ADMIN_LIKE.includes(req.user!.role),
    });

    await prisma.waitlistEntry.update({
      where: { id: entry.id },
      data: {
        status: WaitlistStatus.SEATED,
        seatedAt: new Date(),
        tableSessionId: result.sessionId,
      },
    });

    await writeAuditLog({
      branchId,
      actorId: req.user!.id,
      action: "WAITLIST_SEATED",
      entity: "WaitlistEntry",
      entityId: entry.id,
      meta: { queueNumber: entry.queueNumber, tableId, sessionId: result.sessionId },
    });

    const session = await prisma.tableSession.findUnique({
      where: { id: result.sessionId },
      include: { waiter: { select: { id: true, name: true } }, orders: { select: { total: true, status: true } } },
    });
    res.status(201).json({ session: serializeSession(session), queueNumber: entry.queueNumber });
  } catch (err) {
    const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 500;
    const code = typeof err === "object" && err && "code" in err ? (err as { code: string }).code : undefined;
    return res.status(status).json({ error: err instanceof Error ? err.message : "Could not seat", code });
  }
});

/** Guest-facing queue board (no names — queue #, party size, estimated wait). */
dineInPublicRouter.get("/waitlist", async (req, res) => {
  const branchId = String(req.query.branchId || "");
  if (!branchId) return res.status(400).json({ error: "branchId is required." });
  const branch = await prisma.branch.findFirst({ where: { id: branchId, isActive: true } });
  if (!branch) return res.status(404).json({ error: "Branch not found." });
  const data = await listWaitlistForBranch(branch.id, branch.timezone);
  res.json({
    branchName: branch.name,
    queueDate: data.queueDate,
    updatedAt: new Date().toISOString(),
    queue: data.entries
      .filter((e) => e.status === WaitlistStatus.WAITING || e.status === WaitlistStatus.CALLED)
      .map((e) => ({
        queueNumber: e.queueNumber,
        partySize: e.partySize,
        position: e.position,
        estimatedWaitMin: e.estimatedWaitMin,
        status: e.status,
        seating: e.preferredSeatType ? seatTypeLabel(e.preferredSeatType) : "Any",
      })),
  });
});

dineInRouter.get("/pending-count", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  try {
    const scope = await resolveBranchScope(req);
    const where =
      scope.allBranches || !scope.branchId
        ? { status: ReservationStatus.PENDING }
        : { branchId: scope.branchId, status: ReservationStatus.PENDING };
    const count = await prisma.reservation.count({ where });
    res.json({ count });
  } catch (err) {
    return branchScopeError(res, err);
  }
});
