import { api } from "./api";
import { Order } from "./types";

export async function setKitchenRush(orderId: string, isRush: boolean) {
  return api<Order>(`/kitchen/orders/${orderId}/rush`, {
    method: "PATCH",
    body: JSON.stringify({ isRush }),
  });
}

export async function setKitchenItemDone(orderId: string, itemId: string, done: boolean) {
  return api<Order>(`/kitchen/orders/${orderId}/items/${itemId}/done`, {
    method: "PATCH",
    body: JSON.stringify({ done }),
  });
}

export type KitchenRejectReason = "OUT_OF_STOCK" | "EQUIPMENT" | "OTHER";

export async function rejectKitchenOrder(
  orderId: string,
  body: {
    scope: "order" | "item";
    reasonCode: KitchenRejectReason;
    reasonNote?: string;
    itemId?: string;
  }
) {
  return api<Order>(`/kitchen/orders/${orderId}/reject`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function setMenuItemStock(menuItemId: string, isAvailable: boolean) {
  return api<{ id: string; name: string; isAvailable: boolean }>(`/kitchen/menu/${menuItemId}/stock`, {
    method: "PATCH",
    body: JSON.stringify({ isAvailable }),
  });
}

export async function closeStaleKitchenOrders(hours = 2) {
  return api<{ closed: number }>(`/kitchen/stale/close`, {
    method: "POST",
    body: JSON.stringify({ hours }),
  });
}

export async function recordKotPrint(orderId: string) {
  return api<{ kotPrintedAt: string; kotPrintCount: number; isReprint: boolean }>(
    `/admin/kot/orders/${orderId}/print`,
    { method: "POST" }
  );
}

export type KitchenAlertEvent = {
  type: "kitchen_reject_order" | "kitchen_reject_item" | "menu_86";
  orderId: string;
  orderNumber: string;
  message: string;
  at: number;
};
