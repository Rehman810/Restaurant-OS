import { FulfillmentType, OrderSource, OrderStatus, Role } from "@prisma/client";
import { prisma } from "../prisma";
import { canTransitionStatus, chefKitchenUndoStatus, chefNextStatus } from "../order-status";
import { deliveryNeedsRider, pickLeastBusyRider } from "../rider-assign";
import { getStoreSettings } from "../settings-data";
import { writeAudit } from "../audit";
import { AuditAction } from "../audit-actions";
import { recordRiderCodOnDelivered, releaseRiderCashOnCancel } from "../rider-cod";
import { maybeAwardLoyalty } from "../loyalty-award";
import {
  resolveStaffVoidApproval,
} from "../order-approval";
import type { AuthUser } from "../../middleware/auth";
import {
  sendOrderCancelledEmail,
  sendOrderConfirmedEmail,
  sendOrderDeliveredEmail,
  sendOrderOnTheWayEmail,
  sendOrderPreparingEmail,
  sendRiderAssignedEmail,
} from "../email";
import { emitOrderChange } from "../realtime";
import { generateInvoicePdf } from "../invoice";

const include = {
  items: { include: { menuItem: { select: { printStationId: true } } } },
  diningTable: { select: { id: true, label: true } },
  rider: { select: { id: true, name: true, phone: true } },
  invoice: true,
  feedback: true,
  deliveryArea: { select: { id: true, name: true, deliveryCharge: true } },
};

export type TransitionInput = {
  orderId: string;
  targetStatus: OrderStatus;
  reason?: string;
  voidReasonCode?: string;
  voidReasonNote?: string;
  approval?: { approverId?: string; pin?: string };
  collectedAmount?: number;
  varianceReason?: string;
  ip?: string;
  /** One-step pipeline undo (live board / kitchen). */
  boardUndo?: boolean;
};

export async function transitionOrder(user: AuthUser, input: TransitionInput) {
  const status = input.targetStatus;
  const existing = await prisma.order.findUnique({ where: { id: input.orderId } });
  if (!existing) {
    return { ok: false as const, status: 404, error: "Order not found." };
  }

  const storeSettings = await getStoreSettings();
  let voidMeta: { reasonCode: string; reasonNote: string | null; approverId: string | null } | null =
    null;

  if (status === OrderStatus.CANCELLED) {
    const voidCheck = await resolveStaffVoidApproval(
      { id: user.id, role: user.role },
      storeSettings,
      {
        reason: input.reason,
        voidReasonCode: input.voidReasonCode,
        voidReasonNote: input.voidReasonNote,
        approval: input.approval,
      },
      false,
      { ip: input.ip }
    );
    if (!voidCheck.ok) {
      return { ok: false as const, status: voidCheck.status, error: voidCheck.error, code: voidCheck.code };
    }
    voidMeta = voidCheck;
    if (!voidMeta.reasonCode && !input.reason?.trim()) {
      return { ok: false as const, status: 400, error: "A cancellation reason is required." };
    }
  }

  if (user.role === Role.CHEF) {
    const next = chefNextStatus(existing.status, existing.fulfillmentType);
    if (!next || status !== next) {
      return {
        ok: false as const,
        status: 403,
        error: "Chefs can only advance orders one kitchen step at a time.",
      };
    }
  } else if (user.role === Role.RIDER) {
    return { ok: false as const, status: 403, error: "Riders cannot change order status here." };
  } else if (
    user.role === Role.ADMIN ||
    user.role === Role.MANAGER ||
    user.role === Role.CASHIER ||
    user.role === Role.WAITER
  ) {
    if (input.boardUndo) {
      if (!chefKitchenUndoStatus(existing.status, status, existing.fulfillmentType)) {
        return {
          ok: false as const,
          status: 400,
          error: "That status change cannot be undone.",
        };
      }
    } else if (!canTransitionStatus(existing.status, status, existing.fulfillmentType)) {
      return {
        ok: false as const,
        status: 400,
        error: `Cannot change status from ${existing.status} to ${status}.`,
      };
    }
  } else {
    return { ok: false as const, status: 403, error: "Not allowed." };
  }

  if (
    existing.fulfillmentType !== FulfillmentType.DELIVERY &&
    status === OrderStatus.OUT_FOR_DELIVERY
  ) {
    return {
      ok: false as const,
      status: 400,
      error: "Only delivery orders can go out for delivery.",
    };
  }

  let riderId = existing.riderId;
  const needsRider = deliveryNeedsRider(existing.fulfillmentType);

  if (
    needsRider &&
    (status === OrderStatus.OUT_FOR_DELIVERY || status === OrderStatus.DELIVERED) &&
    !riderId
  ) {
    if (storeSettings.autoAssignRiders && status === OrderStatus.OUT_FOR_DELIVERY) {
      riderId = await pickLeastBusyRider();
    }
    if (!riderId) {
      const error =
        status === OrderStatus.OUT_FOR_DELIVERY
          ? storeSettings.autoAssignRiders
            ? "No riders available. Add a rider account first."
            : "Assign a rider before sending this order out for delivery."
          : "Assign a rider before marking this order delivered.";
      return { ok: false as const, status: 400, error };
    }
  }

  const order = await prisma.$transaction(async (tx) => {
    const readyAt =
      status === OrderStatus.READY
        ? new Date()
        : existing.status === OrderStatus.READY
          ? null
          : existing.readyAt;

    const updated = await tx.order.update({
      where: { id: input.orderId },
      data: {
        status,
        readyAt,
        ...(riderId && !existing.riderId ? { riderId } : {}),
        ...(voidMeta
          ? {
              voidReasonCode: voidMeta.reasonCode,
              voidReasonNote: voidMeta.reasonNote,
              voidApprovedById: voidMeta.approverId,
            }
          : {}),
        events: {
          create: {
            fromStatus: existing.status,
            toStatus: status,
            actorId: user.id,
            actorRole: user.role,
            reason: voidMeta?.reasonCode || input.reason || null,
          },
        },
      },
      include,
    });

    const auditAction =
      status === OrderStatus.CANCELLED
        ? existing.orderSource === OrderSource.POS
          ? AuditAction.ORDER_VOIDED
          : AuditAction.ORDER_CANCELLED
        : AuditAction.ORDER_STATUS_CHANGED;

    await writeAudit(tx, {
      actorId: user.id,
      actorRole: user.role,
      branchId: existing.branchId,
      action: auditAction,
      entityType: "order",
      entityId: updated.id,
      before: { status: existing.status, riderId: existing.riderId },
      after: { status, riderId: updated.riderId },
      reason: voidMeta?.reasonCode || input.reason || null,
      ip: input.ip,
    });

    if (status === OrderStatus.CANCELLED) {
      await releaseRiderCashOnCancel(tx, existing.id);
    }
    if (status === OrderStatus.DELIVERED) {
      await recordRiderCodOnDelivered(tx, updated, {
        collectedAmount: input.collectedAmount,
        varianceReason: input.varianceReason,
      });
    }
    if (
      status === OrderStatus.DELIVERED ||
      status === OrderStatus.COLLECTED ||
      status === OrderStatus.SERVED
    ) {
      await maybeAwardLoyalty(tx, updated.id);
    }
    return updated;
  });

  if (
    existing.status === OrderStatus.PENDING_CONFIRMATION &&
    status === OrderStatus.CONFIRMED
  ) {
    void sendOrderConfirmedEmail(order);
  }
  if (status === OrderStatus.PREPARING && existing.status !== OrderStatus.PREPARING) {
    void sendOrderPreparingEmail(order);
    const { deductInventoryForOrder } = await import("../inventory/stock");
    void deductInventoryForOrder(order.id, user.id).catch(() => null);
  }
  if (status === OrderStatus.OUT_FOR_DELIVERY && existing.status !== OrderStatus.OUT_FOR_DELIVERY) {
    void sendOrderOnTheWayEmail(order);
    if (riderId && riderId !== existing.riderId) {
      const rider = await prisma.user.findUnique({ where: { id: riderId } });
      if (rider) void sendRiderAssignedEmail(rider.email, rider.name, order);
    }
  }
  if (status === OrderStatus.CANCELLED && existing.status !== OrderStatus.CANCELLED) {
    void sendOrderCancelledEmail(order);
    const { reverseInventoryForOrder } = await import("../inventory/stock");
    void reverseInventoryForOrder(order.id, user.id).catch(() => null);
    const { issueCreditNoteForOrder } = await import("../tax/invoicing");
    void issueCreditNoteForOrder(order.id).catch(() => null);
  }
  if (status === OrderStatus.DELIVERED) {
    await generateInvoicePdf(order.id);
    void sendOrderDeliveredEmail(order);
  }
  if (status !== existing.status) {
    const { notifyOrderStatusPush } = await import("../web-push");
    void notifyOrderStatusPush(order.id, status, order.fulfillmentType).catch(() => null);
  }

  emitOrderChange("order:updated", order);
  return { ok: true as const, order };
}
