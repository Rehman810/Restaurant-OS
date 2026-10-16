import { Router } from "express";
import { OrderStatus, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { sendOrderDeliveredEmail } from "../lib/email";
import { generateInvoicePdf } from "../lib/invoice";
import { emitOrderChange } from "../lib/realtime";
import { recordRiderCodOnDelivered } from "../lib/rider-cod";
import { writeAudit } from "../lib/audit";
import { AuditAction } from "../lib/audit-actions";
import { clientIp } from "../lib/client-ip";
import { maybeAwardLoyalty } from "../lib/loyalty-award";

export const riderRouter = Router();

const include = {
  items: true,
  invoice: true,
};

riderRouter.get("/orders", requireAuth, requireRole(Role.RIDER), async (req, res) => {
  const orders = await prisma.order.findMany({
    where: {
      riderId: req.user!.id,
      status: {
        in: [OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED],
      },
    },
    include,
    orderBy: { createdAt: "desc" },
  });
  res.json(orders);
});

riderRouter.get("/cash/pending", requireAuth, requireRole(Role.RIDER), async (req, res) => {
  const pending = await prisma.riderCashEntry.findMany({
    where: { riderId: req.user!.id, status: "PENDING" },
    select: { collectedAmount: true, deliveredAt: true },
  });
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const today = pending.filter((e) => e.deliveredAt >= start);
  const totalToday = today.reduce((s, e) => s + Number(e.collectedAmount), 0);
  const totalAll = pending.reduce((s, e) => s + Number(e.collectedAmount), 0);
  res.json({ pendingCount: pending.length, totalPending: totalAll, todayCount: today.length, todayPending: totalToday });
});

riderRouter.patch("/orders/:id/status", requireAuth, requireRole(Role.RIDER), async (req, res) => {
  const action = req.body.action as "PICKED_UP" | "DELIVERED";
  const collectedAmount =
    req.body.collectedAmount !== undefined ? Number(req.body.collectedAmount) : undefined;
  const varianceReason =
    typeof req.body.varianceReason === "string" ? req.body.varianceReason.trim() : undefined;
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order || order.riderId !== req.user!.id) {
    return res.status(404).json({ error: "Order not assigned to you." });
  }
  if (action === "PICKED_UP" && order.status !== OrderStatus.READY) {
    return res.status(400).json({ error: "Order is not ready for pickup." });
  }
  if (action === "DELIVERED" && order.status !== OrderStatus.OUT_FOR_DELIVERY) {
    return res.status(400).json({ error: "Mark the order picked up before delivering." });
  }
  let status: OrderStatus = order.status;
  if (action === "PICKED_UP") status = OrderStatus.OUT_FOR_DELIVERY;
  if (action === "DELIVERED") status = OrderStatus.DELIVERED;

  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
      const row = await tx.order.update({
        where: { id: order.id },
        data: {
          status,
          events: {
            create: {
              fromStatus: order.status,
              toStatus: status,
              actorId: req.user!.id,
              actorRole: req.user!.role,
            },
          },
        },
        include,
      });
      if (status === OrderStatus.DELIVERED) {
        const cod = await recordRiderCodOnDelivered(tx, row, {
          collectedAmount,
          varianceReason,
        });
        await maybeAwardLoyalty(tx, row.id);
        if (cod?.created) {
          await writeAudit(tx, {
            actorId: req.user!.id,
            actorRole: req.user!.role,
            branchId: row.branchId,
            action: AuditAction.RIDER_CASH_COLLECTED,
            entityType: "rider_cash_entry",
            entityId: cod.entry.id,
            after: {
              orderId: row.id,
              expected: Number(row.total),
              collected: collectedAmount ?? Number(row.total),
            },
            reason: varianceReason || null,
            ip: clientIp(req) ?? undefined,
          });
        }
      }
      return row;
    });
  } catch (err) {
    const e = err as Error & { status?: number };
    return res.status(e.status || 500).json({ error: e.message });
  }
  if (status === OrderStatus.DELIVERED) {
    await generateInvoicePdf(updated.id);
    const withItems = await prisma.order.findUnique({ where: { id: updated.id }, include });
    if (withItems) void sendOrderDeliveredEmail(withItems);
  }
  const fresh = await prisma.order.findUnique({ where: { id: updated.id }, include });
  emitOrderChange("order:updated", updated);
  res.json(fresh);
});
