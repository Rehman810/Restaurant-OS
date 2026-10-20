import { Router, type Request } from "express";
import { OrderStatus, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { branchScopeError, isOrderOutsideUserBranch, resolveBranchScope } from "../lib/branch-scope";
import { emitKitchenAlert, emitOrderChange } from "../lib/realtime";
import { writeAudit } from "../lib/audit";
import { AuditAction } from "../lib/audit-actions";
import { clientIp } from "../lib/client-ip";
import { chefNextStatus } from "../lib/order-status";

export const kitchenRouter = Router();

const KITCHEN_OPS: Role[] = [Role.ADMIN, Role.MANAGER, Role.CHEF, Role.CASHIER];
const KITCHEN_MANAGERS: Role[] = [Role.ADMIN, Role.MANAGER];

const REJECT_REASONS = new Set(["OUT_OF_STOCK", "EQUIPMENT", "OTHER"]);

const orderInclude = {
  items: { include: { menuItem: { select: { printStationId: true, isAvailable: true, name: true } } } },
  diningTable: { select: { id: true, label: true } },
};

async function loadOrderForKitchen(orderId: string, req: Request) {
  const existing = await prisma.order.findUnique({ where: { id: orderId }, include: orderInclude });
  if (!existing) return { error: { status: 404, message: "Order not found." } };
  if (await isOrderOutsideUserBranch(req.user!, existing)) {
    return { error: { status: 403, message: "You do not have access to this order." } };
  }
  return { order: existing };
}

kitchenRouter.patch("/orders/:id/rush", requireAuth, requireRole(...KITCHEN_OPS), async (req, res) => {
  const { order, error } = await loadOrderForKitchen(req.params.id, req);
  if (error) return res.status(error.status).json({ error: error.message });
  const isRush = Boolean(req.body.isRush);
  const updated = await prisma.order.update({
    where: { id: order!.id },
    data: { isRush },
    include: orderInclude,
  });
  emitOrderChange("order:updated", updated);
  res.json(updated);
});

kitchenRouter.patch("/orders/:orderId/items/:itemId/done", requireAuth, requireRole(...KITCHEN_OPS), async (req, res) => {
  const { order, error } = await loadOrderForKitchen(req.params.orderId, req);
  if (error) return res.status(error.status).json({ error: error.message });
  const line = order!.items.find((i) => i.id === req.params.itemId);
  if (!line) return res.status(404).json({ error: "Line item not found." });

  const done = req.body.done !== false;
  const kitchenDoneAt = done ? new Date() : null;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.orderItem.update({
      where: { id: line.id },
      data: { kitchenDoneAt },
    });
    const fresh = await tx.order.findUniqueOrThrow({ where: { id: order!.id }, include: orderInclude });
    const allDone =
      fresh.items.length > 0 && fresh.items.every((i) => i.kitchenDoneAt != null);
    if (
      allDone &&
      fresh.status === OrderStatus.PREPARING &&
      chefNextStatus(fresh.status, fresh.fulfillmentType) === OrderStatus.READY
    ) {
      return tx.order.update({
        where: { id: fresh.id },
        data: { status: OrderStatus.READY, readyAt: new Date() },
        include: orderInclude,
      });
    }
    return fresh;
  });

  emitOrderChange("order:updated", updated);
  res.json(updated);
});

kitchenRouter.post("/orders/:id/reject", requireAuth, requireRole(...KITCHEN_OPS), async (req, res) => {
  const { order, error } = await loadOrderForKitchen(req.params.id, req);
  if (error) return res.status(error.status).json({ error: error.message });

  const scope = String(req.body.scope || "order");
  const reasonCode = String(req.body.reasonCode || "").trim();
  const reasonNote = typeof req.body.reasonNote === "string" ? req.body.reasonNote.trim() : "";
  const itemId = typeof req.body.itemId === "string" ? req.body.itemId : "";

  if (!REJECT_REASONS.has(reasonCode)) {
    return res.status(400).json({ error: "Pick a reject reason." });
  }
  if (reasonCode === "OTHER" && reasonNote.length < 3) {
    return res.status(400).json({ error: "Add a short note for this reject." });
  }

  const label =
    reasonCode === "OUT_OF_STOCK"
      ? "Out of stock"
      : reasonCode === "EQUIPMENT"
        ? "Equipment issue"
        : reasonNote || "Kitchen cannot make";

  if (scope === "item") {
    const line = order!.items.find((i) => i.id === itemId);
    if (!line) return res.status(404).json({ error: "Line item not found." });
    const note = `[Kitchen] Cannot make: ${line.nameAtOrder} — ${label}`;
    const updated = await prisma.order.update({
      where: { id: order!.id },
      data: {
        needsReview: true,
        needsReviewReason: note,
        notes: order!.notes ? `${order!.notes}\n${note}` : note,
      },
      include: orderInclude,
    });
    emitKitchenAlert({
      type: "kitchen_reject_item",
      orderId: updated.id,
      orderNumber: updated.orderNumber,
      message: note,
    });
    emitOrderChange("order:updated", updated);
    return res.json(updated);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const o = await tx.order.update({
      where: { id: order!.id },
      data: {
        status: OrderStatus.CANCELLED,
        voidReasonCode: `KITCHEN_${reasonCode}`,
        voidReasonNote: reasonNote || label,
        needsReview: true,
        needsReviewReason: `Kitchen rejected order: ${label}`,
      },
      include: orderInclude,
    });
    await tx.orderEvent.create({
      data: {
        orderId: o.id,
        fromStatus: order!.status,
        toStatus: OrderStatus.CANCELLED,
        actorId: req.user!.id,
        actorRole: req.user!.role,
        reason: `kitchen_reject:${reasonCode}`,
      },
    });
    return o;
  });

  emitKitchenAlert({
    type: "kitchen_reject_order",
    orderId: updated.id,
    orderNumber: updated.orderNumber,
    message: `Kitchen rejected ${updated.orderNumber}: ${label}`,
  });
  emitOrderChange("order:updated", updated);
  res.json(updated);
});

kitchenRouter.patch("/menu/:menuItemId/stock", requireAuth, requireRole(...KITCHEN_OPS), async (req, res) => {
  const available = req.body.isAvailable !== false;
  const prior = await prisma.menuItem.findUnique({ where: { id: req.params.menuItemId } });
  if (!prior) return res.status(404).json({ error: "Menu item not found." });

  const item = await prisma.menuItem.update({
    where: { id: prior.id },
    data: { isAvailable: available },
  });

  if (prior.isAvailable !== item.isAvailable) {
    await writeAudit(prisma, {
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: AuditAction.ITEM_AVAILABILITY_CHANGED,
      entityType: "menu_item",
      entityId: item.id,
      before: { isAvailable: prior.isAvailable },
      after: { isAvailable: item.isAvailable },
      ip: clientIp(req),
    });
  }

  emitKitchenAlert({
    type: "menu_86",
    orderId: "",
    orderNumber: "",
    message: available ? `${item.name} is back on the menu` : `86 — ${item.name} marked out of stock`,
  });

  res.json({ id: item.id, name: item.name, isAvailable: item.isAvailable });
});

kitchenRouter.post("/stale/close", requireAuth, requireRole(...KITCHEN_MANAGERS), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }

  const hours = Math.min(48, Math.max(1, Number(req.body.hours) || 2));
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const statuses: OrderStatus[] = [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY];

  const stale = await prisma.order.findMany({
    where: {
      ...scope.where,
      status: { in: statuses },
      createdAt: { lt: since },
    },
    select: { id: true },
    take: 100,
  });

  if (!stale.length) {
    return res.json({ closed: 0 });
  }

  await prisma.$transaction(async (tx) => {
    for (const row of stale) {
      await tx.order.update({
        where: { id: row.id },
        data: {
          status: OrderStatus.CANCELLED,
          voidReasonCode: "STALE_KITCHEN",
          voidReasonNote: `Auto-closed after ${hours}h on kitchen board`,
        },
      });
      await tx.orderEvent.create({
        data: {
          orderId: row.id,
          toStatus: OrderStatus.CANCELLED,
          reason: "stale_kitchen_bulk_close",
          actorId: req.user!.id,
          actorRole: req.user!.role,
        },
      });
    }
  });

  for (const row of stale) {
    emitOrderChange("order:updated", { id: row.id });
  }

  res.json({ closed: stale.length });
});

