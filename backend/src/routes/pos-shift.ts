import { Router, type Request } from "express";
import { CashMovementType, OrderSource, OrderStatus, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { ADMIN_LIKE } from "../lib/roles";
import { branchScopeError, getDefaultBranchId, resolveBranchScope } from "../lib/branch-scope";
import {
  buildShiftReport,
  closeCashShift,
  findOpenShift,
  openCashShift,
  recordCashMovement,
  sumDenominations,
  type DenominationBreakdown,
} from "../lib/cash-shift";
import { getStoreSettings } from "../lib/settings-data";
import { writeAudit } from "../lib/audit";
import { AuditAction } from "../lib/audit-actions";
import { clientIp } from "../lib/client-ip";

export const posShiftRouter = Router();

const POS_SHIFT_ROLES = [...ADMIN_LIKE, Role.CASHIER, Role.WAITER];

async function resolvePosBranchId(req: Request) {
  const scope = await resolveBranchScope(req);
  return scope.allBranches ? await getDefaultBranchId() : scope.branchId!;
}

posShiftRouter.get("/current", requireAuth, requireRole(...POS_SHIFT_ROLES), async (req, res) => {
  try {
    const branchId = await resolvePosBranchId(req);
    const shift = await findOpenShift(branchId, req.user!.id);
    if (!shift) return res.json({ shift: null });
    const report = buildShiftReport(shift);
    const orderCount = await prisma.order.count({
      where: {
        branchId,
        createdById: req.user!.id,
        orderSource: OrderSource.POS,
        createdAt: { gte: shift.openedAt },
        status: { not: OrderStatus.CANCELLED },
      },
    });
    res.json({
      shift,
      report,
      cashier: shift.cashier,
      orderCount,
    });
  } catch (err) {
    return branchScopeError(res, err);
  }
});

posShiftRouter.post("/open", requireAuth, requireRole(...POS_SHIFT_ROLES), async (req, res) => {
  const openingCash = Number((req.body as { openingCash?: number }).openingCash ?? 0);
  try {
    const branchId = await resolvePosBranchId(req);
    const shift = await openCashShift(branchId, req.user!.id, openingCash);
    await writeAudit(prisma, {
      actorId: req.user!.id,
      actorRole: req.user!.role,
      branchId,
      action: AuditAction.SHIFT_OPENED,
      entityType: "cash_shift",
      entityId: shift.id,
      entityLabel: `Shift · ${new Date(shift.openedAt).toISOString().slice(0, 10)}`,
      after: { openingCash },
      ip: clientIp(req) ?? undefined,
    });
    res.status(201).json({ shift });
  } catch (err) {
    const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 400;
    const message = err instanceof Error ? err.message : "Could not open shift.";
    res.status(status).json({ error: message });
  }
});

posShiftRouter.post("/paid-in", requireAuth, requireRole(...POS_SHIFT_ROLES), async (req, res) => {
  const { amount, reason } = req.body as { amount?: number; reason?: string };
  try {
    const branchId = await resolvePosBranchId(req);
    const shift = await findOpenShift(branchId, req.user!.id);
    if (!shift) return res.status(403).json({ error: "No open shift.", code: "SHIFT_REQUIRED" });
    const movement = await recordCashMovement(prisma, {
      shiftId: shift.id,
      type: CashMovementType.PAID_IN,
      amount: Number(amount),
      reason: String(reason || ""),
      createdById: req.user!.id,
    });
    res.status(201).json({ movement });
  } catch (err) {
    const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 400;
    res.status(status).json({ error: err instanceof Error ? err.message : "Failed." });
  }
});

posShiftRouter.post("/paid-out", requireAuth, requireRole(...POS_SHIFT_ROLES), async (req, res) => {
  const { amount, reason } = req.body as { amount?: number; reason?: string };
  try {
    const branchId = await resolvePosBranchId(req);
    const shift = await findOpenShift(branchId, req.user!.id);
    if (!shift) return res.status(403).json({ error: "No open shift.", code: "SHIFT_REQUIRED" });
    const movement = await recordCashMovement(prisma, {
      shiftId: shift.id,
      type: CashMovementType.PAID_OUT,
      amount: Number(amount),
      reason: String(reason || ""),
      createdById: req.user!.id,
    });
    res.status(201).json({ movement });
  } catch (err) {
    const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 400;
    res.status(status).json({ error: err instanceof Error ? err.message : "Failed." });
  }
});

posShiftRouter.get("/x-report", requireAuth, requireRole(...POS_SHIFT_ROLES), async (req, res) => {
  try {
    const branchId = await resolvePosBranchId(req);
    const shift = await findOpenShift(branchId, req.user!.id);
    if (!shift) return res.status(404).json({ error: "No open shift." });
    res.json({ shift, report: buildShiftReport(shift) });
  } catch (err) {
    return branchScopeError(res, err);
  }
});

posShiftRouter.post("/close", requireAuth, requireRole(...POS_SHIFT_ROLES), async (req, res) => {
  const body = req.body as {
    countedCash?: number;
    denominations?: DenominationBreakdown;
    note?: string;
    managerNote?: string;
  };
  const counted =
    body.denominations != null ? sumDenominations(body.denominations) : Number(body.countedCash);
  try {
    const branchId = await resolvePosBranchId(req);
    const shift = await findOpenShift(branchId, req.user!.id);
    if (!shift) return res.status(404).json({ error: "No open shift." });
    const settings = await getStoreSettings();
    const closed = await closeCashShift(shift.id, {
      countedCash: counted,
      denominations: body.denominations,
      note: body.note,
      managerNote: body.managerNote,
      varianceTolerance: Number(settings.shiftVarianceTolerance ?? 500),
    });
    await writeAudit(prisma, {
      actorId: req.user!.id,
      actorRole: req.user!.role,
      branchId,
      action: AuditAction.SHIFT_CLOSED,
      entityType: "cash_shift",
      entityId: closed.id,
      entityLabel: `Shift · ${new Date(closed.openedAt).toISOString().slice(0, 10)}`,
      before: { openingCash: Number(shift.openingCash) },
      after: {
        openingCash: Number(shift.openingCash),
        expectedCash: closed.expectedCash,
        countedCash: closed.closingCountedCash,
        variance: closed.variance,
      },
      ip: clientIp(req) ?? undefined,
    });
    res.json({ shift: closed, zReport: buildShiftReport(closed, Number(closed.closingCountedCash)) });
  } catch (err) {
    const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 400;
    const code = typeof err === "object" && err && "code" in err ? String((err as { code: string }).code) : undefined;
    res.status(status).json({ error: err instanceof Error ? err.message : "Could not close shift.", code });
  }
});
