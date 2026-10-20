import { Router } from "express";
import { OrderStatus, Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { ORDER_OPS } from "../lib/roles";
import { branchScopeError, isOrderOutsideUserBranch, resolveBranchScope } from "../lib/branch-scope";
import { getStoreSettings } from "../lib/settings-data";
import { clientIp } from "../lib/client-ip";
import { listAdminOrders } from "../lib/admin-orders/list";
import { getAdminOrderDetail } from "../lib/admin-orders/detail";
import { transitionOrder } from "../lib/admin-orders/transition";
import { assignRiderToOrder, runBulkAdminOrders, type BulkAction } from "../lib/admin-orders/actions";

export const adminOrdersRouter = Router();

const LIST_ROLES = [...ORDER_OPS, Role.RIDER] as Role[];
const ACTION_ROLES = ORDER_OPS;

async function resolveTimezone(scope: Awaited<ReturnType<typeof resolveBranchScope>>) {
  const settings = await getStoreSettings();
  if (!scope.allBranches && scope.branchId) {
    const branch = await prismaBranchTimezone(scope.branchId);
    return branch || settings.timezone || "Asia/Karachi";
  }
  return settings.timezone || "Asia/Karachi";
}

async function prismaBranchTimezone(branchId: string) {
  const { prisma } = await import("../lib/prisma");
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { timezone: true },
  });
  return branch?.timezone;
}

async function dispatchSettings() {
  const settings = await getStoreSettings();
  return {
    lateConfirmMinutes: settings.lateConfirmMinutes ?? 15,
    latePrepMinutes: settings.latePrepMinutes ?? 30,
    lateDeliveryMinutes: settings.lateDeliveryMinutes ?? 45,
    ordersStaleHours: settings.ordersStaleHours ?? 2,
    duplicateOrderWindowMinutes: settings.duplicateOrderWindowMinutes ?? 10,
  };
}

adminOrdersRouter.get("/", requireAuth, requireRole(...LIST_ROLES), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }

  const timeZone = await resolveTimezone(scope);
  const settings = await dispatchSettings();
  const payload = await listAdminOrders(req, scope, req.user!, timeZone, settings);
  res.json(payload);
});

adminOrdersRouter.get("/:id", requireAuth, requireRole(...LIST_ROLES), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }

  const settings = await dispatchSettings();
  const detail = await getAdminOrderDetail(req.params.id, req.user!, settings);
  if (!detail) return res.status(404).json({ error: "Order not found." });

  const { prisma } = await import("../lib/prisma");
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    select: { branchId: true, riderId: true },
  });
  if (!order) return res.status(404).json({ error: "Order not found." });
  if (await isOrderOutsideUserBranch(req.user!, order)) {
    return res.status(403).json({ error: "You do not have access to this order." });
  }
  if (req.user!.role === Role.RIDER && order.riderId !== req.user!.id) {
    return res.status(403).json({ error: "You can only view your assigned deliveries." });
  }
  if (!scope.allBranches && order.branchId && order.branchId !== scope.branchId) {
    return res.status(403).json({ error: "Order is outside your branch." });
  }

  res.json(detail);
});

adminOrdersRouter.post("/:id/transition", requireAuth, requireRole(...ACTION_ROLES), async (req, res) => {
  const targetStatus = req.body?.targetStatus ?? req.body?.status;
  if (!targetStatus || !Object.values(OrderStatus).includes(targetStatus)) {
    return res.status(400).json({ error: "Invalid target status." });
  }

  const existing = await import("../lib/prisma").then((m) =>
    m.prisma.order.findUnique({ where: { id: req.params.id } })
  );
  if (!existing) return res.status(404).json({ error: "Order not found." });
  if (await isOrderOutsideUserBranch(req.user!, existing)) {
    return res.status(403).json({ error: "You do not have access to this order." });
  }

  const result = await transitionOrder(req.user!, {
    orderId: req.params.id,
    targetStatus,
    reason: typeof req.body?.reason === "string" ? req.body.reason : undefined,
    voidReasonCode: typeof req.body?.voidReasonCode === "string" ? req.body.voidReasonCode : undefined,
    voidReasonNote: typeof req.body?.voidReasonNote === "string" ? req.body.voidReasonNote : undefined,
    approval: req.body?.approval,
    collectedAmount: req.body?.collectedAmount,
    varianceReason: req.body?.varianceReason,
    ip: clientIp(req) ?? undefined,
    boardUndo: req.body?.boardUndo === true,
  });

  if (!result.ok) {
    return res.status(result.status).json({ error: result.error, code: result.code });
  }
  res.json({ ok: true, orderId: result.order.id, status: result.order.status });
});

adminOrdersRouter.post("/:id/assign-rider", requireAuth, requireRole(...ACTION_ROLES), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }

  const riderId = String(req.body?.riderId || "").trim();
  if (!riderId) return res.status(400).json({ error: "riderId is required." });

  const existing = await import("../lib/prisma").then((m) =>
    m.prisma.order.findUnique({ where: { id: req.params.id } })
  );
  if (!existing) return res.status(404).json({ error: "Order not found." });
  if (await isOrderOutsideUserBranch(req.user!, existing)) {
    return res.status(403).json({ error: "You do not have access to this order." });
  }

  const result = await assignRiderToOrder(
    req.user!,
    scope,
    req.params.id,
    riderId,
    clientIp(req) ?? undefined
  );
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  res.json({ ok: true, orderId: result.order.id, riderId: result.order.riderId });
});

adminOrdersRouter.post("/bulk", requireAuth, requireRole(...ACTION_ROLES), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }

  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
  if (!ids.length) return res.status(400).json({ error: "ids array is required." });
  if (ids.length > 50) return res.status(400).json({ error: "Maximum 50 orders per bulk action." });

  const actionRaw = req.body?.action;
  let action: BulkAction;
  if (actionRaw === "transition") {
    const targetStatus = req.body?.targetStatus;
    if (!targetStatus || !Object.values(OrderStatus).includes(targetStatus)) {
      return res.status(400).json({ error: "targetStatus is required for transition." });
    }
    action = {
      type: "transition",
      targetStatus,
      reason: req.body?.reason,
      voidReasonCode: req.body?.voidReasonCode,
      voidReasonNote: req.body?.voidReasonNote,
    };
  } else if (actionRaw === "assignRider") {
    const riderId = String(req.body?.riderId || "").trim();
    if (!riderId) return res.status(400).json({ error: "riderId is required." });
    action = { type: "assignRider", riderId };
  } else if (actionRaw === "printKot") {
    action = { type: "printKot" };
  } else if (actionRaw === "cancelStale") {
    const reason = String(req.body?.reason || req.body?.voidReasonCode || "").trim();
    if (!reason) return res.status(400).json({ error: "A cancellation reason is required." });
    action = { type: "cancelStale", reason, voidReasonCode: req.body?.voidReasonCode };
  } else {
    return res.status(400).json({ error: "Invalid bulk action." });
  }

  const { prisma } = await import("../lib/prisma");
  for (const id of ids) {
    const order = await prisma.order.findUnique({ where: { id }, select: { branchId: true } });
    if (order && (await isOrderOutsideUserBranch(req.user!, order))) {
      return res.status(403).json({ error: `No access to order ${id}.` });
    }
  }

  const outcome = await runBulkAdminOrders(
    req.user!,
    scope,
    ids,
    action,
    clientIp(req) ?? undefined
  );
  res.json(outcome);
});
