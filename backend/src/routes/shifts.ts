import { Router } from "express";
import { CashMovementType, CashShiftStatus, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { ADMIN_LIKE } from "../lib/roles";
import { branchScopeError, resolveBranchScope } from "../lib/branch-scope";
import { buildShiftReport, recordCashMovement } from "../lib/cash-shift";
import { writeAudit } from "../lib/audit";
import { AuditAction } from "../lib/audit-actions";
import { clientIp } from "../lib/client-ip";
import { requireEntitlement } from "../lib/platform/entitlement-middleware";

export const shiftsRouter = Router();
shiftsRouter.use(requireEntitlement("shifts"));

function parseDate(v: unknown) {
  if (!v || typeof v !== "string") return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

shiftsRouter.get("/", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const from = parseDate(req.query.from);
  const to = parseDate(req.query.to);
  const branchFilter = typeof req.query.branchId === "string" ? req.query.branchId.trim() : "";
  const where: Record<string, unknown> = {};
  if (!scope.allBranches) where.branchId = scope.branchId;
  else if (branchFilter) where.branchId = branchFilter;
  if (from || to) {
    where.openedAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const [rows, total] = await Promise.all([
    prisma.cashShift.findMany({
      where,
      orderBy: { openedAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        cashier: { select: { id: true, name: true, email: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
    }),
    prisma.cashShift.count({ where }),
  ]);
  res.json({ shifts: rows, total, limit, offset });
});

shiftsRouter.get("/export.csv", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }
  const where: Record<string, unknown> = {};
  if (!scope.allBranches) where.branchId = scope.branchId;
  const rows = await prisma.cashShift.findMany({
    where,
    orderBy: { openedAt: "desc" },
    take: 5000,
    include: { cashier: { select: { name: true } }, branch: { select: { code: true } } },
  });
  const header =
    "openedAt,closedAt,branch,cashier,status,openingCash,expectedCash,counted,variance\n";
  const lines = rows.map((r) => {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    return [
      r.openedAt.toISOString(),
      r.closedAt?.toISOString() || "",
      esc(r.branch.code),
      esc(r.cashier.name),
      r.status,
      r.openingCash.toString(),
      r.expectedCash?.toString() || "",
      r.closingCountedCash?.toString() || "",
      r.variance?.toString() || "",
    ].join(",");
  });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="shifts.csv"');
  res.send(header + lines.join("\n"));
});

shiftsRouter.get("/:id", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  const shift = await prisma.cashShift.findUnique({
    where: { id: req.params.id },
    include: {
      movements: { orderBy: { createdAt: "asc" }, include: { order: { select: { orderNumber: true } } } },
      cashier: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true, code: true } },
    },
  });
  if (!shift) return res.status(404).json({ error: "Shift not found." });
  const report = buildShiftReport(
    shift,
    shift.closingCountedCash != null ? Number(shift.closingCountedCash) : null
  );
  res.json({ shift, report });
});

shiftsRouter.post("/:id/adjustments", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  const { amount, reason, direction } = req.body as {
    amount?: number;
    reason?: string;
    direction?: "in" | "out";
  };
  const shift = await prisma.cashShift.findUnique({ where: { id: req.params.id } });
  if (!shift) return res.status(404).json({ error: "Shift not found." });
  if (shift.status !== CashShiftStatus.CLOSED) {
    return res.status(400).json({ error: "Adjustments apply to closed shifts only." });
  }
  const type =
    direction === "out" ? CashMovementType.PAID_OUT : CashMovementType.ADJUSTMENT;
  try {
    const movement = await recordCashMovement(prisma, {
      shiftId: shift.id,
      type,
      amount: Number(amount),
      reason: String(reason || "Manager adjustment"),
      createdById: req.user!.id,
      allowClosed: true,
    });
    await writeAudit(prisma, {
      actorId: req.user!.id,
      actorRole: req.user!.role,
      branchId: shift.branchId,
      action: AuditAction.CASH_SHIFT_ADJUSTMENT,
      entityType: "cash_shift",
      entityId: shift.id,
      after: { movementId: movement.id, amount, type },
      reason: String(reason || ""),
      ip: clientIp(req) ?? undefined,
    });
    res.status(201).json({ movement });
  } catch (err) {
    const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 400;
    res.status(status).json({ error: err instanceof Error ? err.message : "Failed." });
  }
});
