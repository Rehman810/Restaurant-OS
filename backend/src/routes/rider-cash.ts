import { Router } from "express";
import { RiderCashEntryStatus, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { ADMIN_LIKE } from "../lib/roles";
import { branchScopeError, resolveBranchScope } from "../lib/branch-scope";
import { getStoreSettings } from "../lib/settings-data";
import { settleRiderCashEntries } from "../lib/rider-cod";
import { writeAudit } from "../lib/audit";
import { AuditAction } from "../lib/audit-actions";
import { clientIp } from "../lib/client-ip";
import { requireEntitlement } from "../lib/platform/entitlement-middleware";

export const riderCashRouter = Router();
riderCashRouter.use(requireEntitlement("delivery"));

const SETTLE_ROLES: Role[] = [Role.ADMIN, Role.MANAGER, Role.CASHIER];

function branchWhere(scope: Awaited<ReturnType<typeof resolveBranchScope>>): { branchId?: string } {
  if (scope.allBranches || !scope.branchId) return {};
  return { branchId: scope.branchId };
}

riderCashRouter.get("/summary", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }
  const settings = await getStoreSettings();
  const staleHours = settings.riderCashStaleHours ?? 24;
  const staleBefore = new Date(Date.now() - staleHours * 60 * 60 * 1000);
  const bw = branchWhere(scope);

  const pending = await prisma.riderCashEntry.findMany({
    where: { ...bw, status: RiderCashEntryStatus.PENDING },
    select: {
      id: true,
      collectedAmount: true,
      deliveredAt: true,
      riderId: true,
      rider: { select: { id: true, name: true } },
    },
  });

  const totalPending = pending.reduce((s, e) => s + Number(e.collectedAmount), 0);
  const staleCount = pending.filter((e) => e.deliveredAt < staleBefore).length;
  const byRider = new Map<string, { riderId: string; name: string; pendingAmount: number; count: number }>();
  for (const e of pending) {
    const cur = byRider.get(e.riderId) || {
      riderId: e.riderId,
      name: e.rider.name,
      pendingAmount: 0,
      count: 0,
    };
    cur.pendingAmount += Number(e.collectedAmount);
    cur.count += 1;
    byRider.set(e.riderId, cur);
  }

  res.json({
    totalPending,
    pendingCount: pending.length,
    staleCount,
    staleHours,
    riders: [...byRider.values()].sort((a, b) => b.pendingAmount - a.pendingAmount),
  });
});

riderCashRouter.get("/ledger", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }
  const riderId = typeof req.query.riderId === "string" ? req.query.riderId.trim() : "";
  const status =
    req.query.status === "SETTLED"
      ? RiderCashEntryStatus.SETTLED
      : req.query.status === "PENDING"
        ? RiderCashEntryStatus.PENDING
        : undefined;
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const offset = Math.max(0, Number(req.query.offset) || 0);

  const where = {
    ...branchWhere(scope),
    ...(riderId ? { riderId } : {}),
    ...(status ? { status } : {}),
  };

  const [entries, total] = await Promise.all([
    prisma.riderCashEntry.findMany({
      where,
      orderBy: { deliveredAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        rider: { select: { id: true, name: true, phone: true } },
        order: { select: { orderNumber: true, customerName: true, total: true } },
        settlement: { select: { id: true, createdAt: true, receivedTotal: true } },
      },
    }),
    prisma.riderCashEntry.count({ where }),
  ]);

  res.json({ entries, total, limit, offset });
});

riderCashRouter.get("/export.csv", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }
  const rows = await prisma.riderCashEntry.findMany({
    where: branchWhere(scope),
    orderBy: { deliveredAt: "desc" },
    take: 5000,
    include: {
      rider: { select: { name: true } },
      order: { select: { orderNumber: true } },
    },
  });
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const header =
    "deliveredAt,status,rider,order,expected,collected,varianceReason,settledAt\n";
  const lines = rows.map((r) =>
    [
      r.deliveredAt.toISOString(),
      r.status,
      esc(r.rider.name),
      esc(r.order.orderNumber),
      r.expectedAmount.toString(),
      r.collectedAmount.toString(),
      esc(r.varianceReason || ""),
      r.settledAt?.toISOString() || "",
    ].join(",")
  );
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="rider-cash.csv"');
  res.send(header + lines.join("\n"));
});

riderCashRouter.post("/settle", requireAuth, requireRole(...SETTLE_ROLES), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }
  if (scope.allBranches) {
    return res.status(400).json({ error: "Select a branch before settling rider cash." });
  }
  const { riderId, entryIds, receivedAmount, note } = req.body as {
    riderId?: string;
    entryIds?: string[];
    receivedAmount?: number;
    note?: string;
  };
  if (!riderId?.trim()) {
    return res.status(400).json({ error: "Rider is required." });
  }
  if (!Array.isArray(entryIds) || !entryIds.length) {
    return res.status(400).json({ error: "Select at least one entry." });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const settled = await settleRiderCashEntries(tx, {
        branchId: scope.branchId!,
        riderId: riderId.trim(),
        entryIds,
        receivedTotal: Number(receivedAmount),
        note,
        settledById: req.user!.id,
        shiftCashierId: req.user!.id,
      });
      await writeAudit(tx, {
        actorId: req.user!.id,
        actorRole: req.user!.role,
        branchId: scope.branchId,
        action: AuditAction.RIDER_CASH_SETTLED,
        entityType: "rider_settlement",
        entityId: settled.settlementId,
        after: {
          riderId,
          entryIds,
          ...settled,
        },
        ip: clientIp(req) ?? undefined,
      });
      return settled;
    });
    res.json(result);
  } catch (err) {
    const e = err as Error & { status?: number; code?: string };
    return res.status(e.status || 500).json({ error: e.message, code: e.code });
  }
});
