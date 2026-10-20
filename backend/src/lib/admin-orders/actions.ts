import { FulfillmentType, OrderStatus, Role } from "@prisma/client";
import { prisma } from "../prisma";
import { riderWhereForScope } from "../branch-scope";
import type { BranchScope } from "../branch-scope";
import { deliveryNeedsRider } from "../rider-assign";
import { writeAudit } from "../audit";
import { AuditAction } from "../audit-actions";
import { transitionOrder } from "./transition";
import type { AuthUser } from "../../middleware/auth";
import {
  sendOrderOnTheWayEmail,
  sendRiderAssignedEmail,
} from "../email";
import { emitOrderChange, emitTrackingBoardDelta } from "../realtime";

export async function assignRiderToOrder(
  user: AuthUser,
  scope: BranchScope,
  orderId: string,
  riderId: string,
  ip?: string
) {
  if (user.role !== Role.ADMIN && user.role !== Role.MANAGER) {
    return { ok: false as const, status: 403, error: "Only managers can assign riders." };
  }

  const rider = await prisma.user.findFirst({
    where: { id: riderId, ...riderWhereForScope(scope), isActive: true },
  });
  if (!rider) {
    return { ok: false as const, status: 400, error: "Rider not found or not active in this branch." };
  }

  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) return { ok: false as const, status: 404, error: "Order not found." };
  if (!deliveryNeedsRider(existing.fulfillmentType)) {
    return { ok: false as const, status: 400, error: "Rider assignment applies to delivery orders only." };
  }
  if (existing.status === OrderStatus.PENDING_CONFIRMATION) {
    return { ok: false as const, status: 400, error: "Confirm the order before assigning a rider." };
  }

  const order = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        riderId,
        ...(existing.status === OrderStatus.READY ? { status: OrderStatus.OUT_FOR_DELIVERY } : {}),
        ...(existing.status === OrderStatus.READY
          ? {
              events: {
                create: {
                  fromStatus: existing.status,
                  toStatus: OrderStatus.OUT_FOR_DELIVERY,
                  actorId: user.id,
                  actorRole: user.role,
                  reason: "assign_rider",
                },
              },
            }
          : {}),
      },
      include: {
        items: true,
        rider: { select: { id: true, name: true, phone: true } },
      },
    });

    await writeAudit(tx, {
      actorId: user.id,
      actorRole: user.role,
      branchId: existing.branchId,
      action: AuditAction.ORDER_STATUS_CHANGED,
      entityType: "order",
      entityId: orderId,
      before: { riderId: existing.riderId },
      after: { riderId },
      reason: "assign_rider",
      ip,
    });
    return updated;
  });

  if (order.status === OrderStatus.OUT_FOR_DELIVERY && existing.status !== OrderStatus.OUT_FOR_DELIVERY) {
    void sendOrderOnTheWayEmail(order);
  }
  void sendRiderAssignedEmail(rider.email, rider.name, order);
  emitOrderChange("order:updated", order);
  emitTrackingBoardDelta(existing.branchId, "rider_assigned", {
    orderId: order.id,
    riderId,
  });

  return { ok: true as const, order };
}

export async function recordKotPrint(user: AuthUser, orderId: string, ip?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false as const, status: 404, error: "Order not found." };

  const isReprint = (order.kotPrintCount ?? 0) > 0;
  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    await tx.kotPrintLog.create({
      data: { orderId, isReprint, actorId: user.id },
    });
    await writeAudit(tx, {
      actorId: user.id,
      actorRole: user.role,
      branchId: order.branchId,
      action: AuditAction.ORDER_STATUS_CHANGED,
      entityType: "order",
      entityId: orderId,
      after: { kotPrint: true, isReprint },
      ip,
    });
    return tx.order.update({
      where: { id: orderId },
      data: { kotPrintedAt: now, kotPrintCount: { increment: 1 } },
    });
  });

  return { ok: true as const, kotPrintedAt: updated.kotPrintedAt, isReprint };
}

export type BulkAction =
  | { type: "transition"; targetStatus: OrderStatus; reason?: string; voidReasonCode?: string; voidReasonNote?: string }
  | { type: "assignRider"; riderId: string }
  | { type: "printKot" }
  | { type: "cancelStale"; reason: string; voidReasonCode?: string; voidReasonNote?: string };

export async function runBulkAdminOrders(
  user: AuthUser,
  scope: BranchScope,
  ids: string[],
  action: BulkAction,
  ip?: string
) {
  const unique = [...new Set(ids)].slice(0, 50);
  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const id of unique) {
    try {
      if (action.type === "transition" || action.type === "cancelStale") {
        const target =
          action.type === "cancelStale" ? OrderStatus.CANCELLED : action.targetStatus;
        const res = await transitionOrder(user, {
          orderId: id,
          targetStatus: target,
          reason: action.reason,
          voidReasonCode: action.voidReasonCode ?? (action.type === "cancelStale" ? "STALE" : undefined),
          voidReasonNote: action.voidReasonNote,
          ip,
        });
        if (!res.ok) {
          results.push({ id, ok: false, error: res.error });
        } else {
          results.push({ id, ok: true });
        }
      } else if (action.type === "assignRider") {
        const res = await assignRiderToOrder(user, scope, id, action.riderId, ip);
        results.push({ id, ok: res.ok, error: res.ok ? undefined : res.error });
      } else if (action.type === "printKot") {
        const res = await recordKotPrint(user, id, ip);
        results.push({ id, ok: res.ok, error: res.ok ? undefined : res.error });
      }
    } catch (err) {
      results.push({
        id,
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return {
    results,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  };
}
