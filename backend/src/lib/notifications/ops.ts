import crypto from "crypto";
import { emitOpsNotification } from "../realtime";

export type OpsNotificationKind =
  | "order_created"
  | "order_updated"
  | "inventory_low_stock"
  | "inventory_out_of_stock"
  | "inventory_restocked"
  | "menu_sold_out"
  | "menu_back_in_stock"
  | "kitchen_alert"
  | "reservation_pending"
  | "platform_announcement"
  | "platform_maintenance";

export type OpsNotificationSeverity = "info" | "warning" | "urgent";

export type OpsNotification = {
  id: string;
  kind: OpsNotificationKind;
  title: string;
  message: string;
  at: number;
  branchId?: string;
  href?: string;
  severity: OpsNotificationSeverity;
  meta?: Record<string, string | number | boolean | null>;
};

function push(notification: Omit<OpsNotification, "id" | "at"> & { id?: string; at?: number }) {
  const payload: OpsNotification = {
    id: notification.id ?? crypto.randomUUID(),
    at: notification.at ?? Date.now(),
    kind: notification.kind,
    title: notification.title,
    message: notification.message,
    severity: notification.severity,
    branchId: notification.branchId,
    href: notification.href,
    meta: notification.meta,
  };
  emitOpsNotification(payload);
  return payload;
}

export function notifyOrderCreated(order: {
  id: string;
  orderNumber: string;
  branchId?: string | null;
  total?: number | string;
  source?: string | null;
}) {
  const total =
    order.total != null
      ? typeof order.total === "string"
        ? Number(order.total)
        : order.total
      : undefined;
  const totalLabel = total != null && Number.isFinite(total) ? ` · ${total.toFixed(0)}` : "";
  const sourceLabel = order.source === "POS" ? " (POS)" : "";
  return push({
    kind: "order_created",
    severity: "urgent",
    title: `New order ${order.orderNumber}`,
    message: `Order ${order.orderNumber}${sourceLabel} needs attention${totalLabel}.`,
    branchId: order.branchId ?? undefined,
    href: `/admin/orders?highlight=${encodeURIComponent(order.id)}`,
    meta: { orderId: order.id, orderNumber: order.orderNumber },
  });
}

export function notifyOrderUpdated(order: {
  id: string;
  orderNumber: string;
  branchId?: string | null;
  status: string;
}) {
  return push({
    kind: "order_updated",
    severity: "info",
    title: `Order ${order.orderNumber} updated`,
    message: `Status is now ${order.status.replace(/_/g, " ").toLowerCase()}.`,
    branchId: order.branchId ?? undefined,
    href: `/admin/orders?highlight=${encodeURIComponent(order.id)}`,
    meta: { orderId: order.id, orderNumber: order.orderNumber, status: order.status },
  });
}

export function notifyStockLevel(input: {
  branchId: string;
  itemId: string;
  itemName: string;
  unit: string;
  quantity: number;
  reorderPoint: number;
  kind: "inventory_low_stock" | "inventory_out_of_stock" | "inventory_restocked";
}) {
  const qty = `${input.quantity} ${input.unit}`.trim();
  if (input.kind === "inventory_out_of_stock") {
    return push({
      kind: input.kind,
      severity: "urgent",
      title: `${input.itemName} is out of stock`,
      message: `Stock at ${qty}. Reorder point is ${input.reorderPoint} ${input.unit}.`,
      branchId: input.branchId,
      href: "/admin/inventory",
      meta: { itemId: input.itemId, quantity: input.quantity },
    });
  }
  if (input.kind === "inventory_low_stock") {
    return push({
      kind: input.kind,
      severity: "warning",
      title: `${input.itemName} is low`,
      message: `${qty} left (reorder at ${input.reorderPoint} ${input.unit}).`,
      branchId: input.branchId,
      href: "/admin/inventory",
      meta: { itemId: input.itemId, quantity: input.quantity },
    });
  }
  return push({
    kind: input.kind,
    severity: "info",
    title: `${input.itemName} restocked`,
    message: `Stock is now ${qty}.`,
    branchId: input.branchId,
    href: "/admin/inventory",
    meta: { itemId: input.itemId, quantity: input.quantity },
  });
}

export function notifyMenuSoldOut(input: {
  branchId: string;
  menuItemId: string;
  name: string;
  reason?: string;
}) {
  return push({
    kind: "menu_sold_out",
    severity: "warning",
    title: `${input.name} sold out`,
    message:
      input.reason === "auto_inventory"
        ? `${input.name} was hidden from the menu (insufficient ingredients).`
        : `${input.name} is no longer available on the menu.`,
    branchId: input.branchId,
    href: "/admin/menu",
    meta: { menuItemId: input.menuItemId, reason: input.reason ?? null },
  });
}

export function notifyMenuBackInStock(input: { branchId: string; menuItemId: string; name: string }) {
  return push({
    kind: "menu_back_in_stock",
    severity: "info",
    title: `${input.name} is available again`,
    message: `${input.name} is back on the menu.`,
    branchId: input.branchId,
    href: "/admin/menu",
    meta: { menuItemId: input.menuItemId },
  });
}

export function notifyKitchenAlert(input: {
  type: string;
  orderId: string;
  orderNumber: string;
  message: string;
}) {
  return push({
    kind: "kitchen_alert",
    severity: "warning",
    title: input.orderNumber ? `Kitchen · ${input.orderNumber}` : "Kitchen alert",
    message: input.message,
    href: input.orderId ? `/admin/kitchen?order=${encodeURIComponent(input.orderId)}` : "/admin/kitchen",
    meta: { alertType: input.type, orderId: input.orderId || null, orderNumber: input.orderNumber || null },
  });
}

export function notifyReservationPending(input: {
  branchId: string;
  reservationId: string;
  guestName: string;
  partySize: number;
  startsAt: string;
}) {
  return push({
    kind: "reservation_pending",
    severity: "warning",
    title: "New table booking",
    message: `${input.guestName} · party of ${input.partySize} · ${input.startsAt}`,
    branchId: input.branchId,
    href: "/admin/dine-in",
    meta: { reservationId: input.reservationId, partySize: input.partySize },
  });
}
