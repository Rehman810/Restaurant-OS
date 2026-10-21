/** Canonical audit action codes (stored as strings in AuditLog.action). New writes use entity.verb. */

export const AuditAction = {
  ORDER_STATUS_CHANGED: "order.status_changed",
  ORDER_CANCELLED: "order.cancelled",
  ORDER_VOIDED: "order.voided",
  REFUND_ISSUED: "order.refunded",
  DISCOUNT_APPLIED: "order.discount_applied",
  ORDER_PRICE_OVERRIDE: "order.price_override",
  ORDER_KOT_REPRINTED: "order.kot_reprinted",
  ORDER_RECEIPT_REPRINTED: "order.receipt_reprinted",

  ITEM_PRICE_CHANGED: "menu.item_price_changed",
  ITEM_AVAILABILITY_CHANGED: "menu.item_availability_changed",
  ITEM_VISIBILITY_CHANGED: "menu.item_visibility_changed",
  MENU_ITEM_ARCHIVED: "menu.item_archived",
  MENU_ITEM_RESTORED: "menu.item_restored",
  MENU_BULK_ACTION: "menu.bulk_action",
  MENU_REORDERED: "menu.reordered",
  CATEGORY_CHANGED: "menu.category_changed",
  DEAL_CHANGED: "menu.deal_changed",

  COUPON_CREATED: "offer.coupon_created",
  COUPON_UPDATED: "offer.coupon_updated",
  COUPON_DELETED: "offer.coupon_deleted",

  SETTINGS_CHANGED: "settings.changed",
  STAFF_CREATED: "staff.created",
  STAFF_ROLE_CHANGED: "staff.role_changed",
  STAFF_DEACTIVATED: "staff.deactivated",
  CUSTOMER_UPDATED: "customer.updated",
  CUSTOMER_BLOCKED: "customer.blocked",
  CUSTOMER_UNBLOCKED: "customer.unblocked",
  BRANCH_CHANGED: "branch.changed",

  LOGIN_FAILED: "security.login_failed",
  LOGIN_SUCCESS: "security.login_success",
  APPROVAL_PIN_FAILED: "security.approval_pin_failed",

  DINE_IN_EVENT: "dine_in.event",
  RESERVATION_CONFIRMED: "reservation.confirmed",
  RESERVATION_REJECTED: "reservation.rejected",
  RESERVATION_SEATED: "reservation.seated",
  RESERVATION_NO_SHOW_AUTO: "reservation.no_show_auto",
  RESERVATION_EXPIRED_UNCONFIRMED: "reservation.expired_unconfirmed",
  WAITLIST_ADDED: "waitlist.added",
  WAITLIST_SEATED: "waitlist.seated",

  SHIFT_OPENED: "shift.opened",
  SHIFT_CLOSED: "shift.closed",
  CASH_SHIFT_ADJUSTMENT: "shift.cash_adjustment",
  RIDER_CASH_COLLECTED: "rider_cash.collected",
  RIDER_CASH_SETTLED: "rider_cash.settled",

  POS_OFFLINE_SYNC_CREATED: "pos.offline_sync_created",
  POS_OFFLINE_SYNC_CONFLICT: "pos.offline_sync_conflict",
  POS_OFFLINE_SYNC_REJECTED: "pos.offline_sync_rejected",
  POS_OFFLINE_QUEUE_DISCARDED: "pos.offline_queue_discarded",
  POS_OFFLINE_LOGOUT_OVERRIDE: "pos.offline_logout_override",

  STOCK_ADJUSTED: "inventory.stock_adjusted",
  PURCHASE_VOIDED: "inventory.purchase_voided",
} as const;

export type AuditActionCode = (typeof AuditAction)[keyof typeof AuditAction];

export type AuditCategory =
  | "Orders"
  | "Cash"
  | "Menu"
  | "Staff"
  | "Settings"
  | "Security"
  | "Reservations"
  | "Inventory"
  | "System";

export type AuditActionMeta = {
  label: string;
  category: AuditCategory;
};

/** Maps stored action string (canonical or legacy) to display metadata. */
const ACTION_META: Record<string, AuditActionMeta> = {
  [AuditAction.ORDER_STATUS_CHANGED]: { label: "Order status changed", category: "Orders" },
  [AuditAction.ORDER_CANCELLED]: { label: "Order cancelled", category: "Orders" },
  [AuditAction.ORDER_VOIDED]: { label: "Order voided", category: "Orders" },
  [AuditAction.REFUND_ISSUED]: { label: "Refund issued", category: "Orders" },
  [AuditAction.DISCOUNT_APPLIED]: { label: "Manual discount applied", category: "Orders" },
  [AuditAction.ORDER_PRICE_OVERRIDE]: { label: "Price override on order", category: "Orders" },
  [AuditAction.ORDER_KOT_REPRINTED]: { label: "Kitchen ticket reprinted", category: "Orders" },
  [AuditAction.ORDER_RECEIPT_REPRINTED]: { label: "Receipt reprinted", category: "Orders" },

  [AuditAction.ITEM_PRICE_CHANGED]: { label: "Dish price changed", category: "Menu" },
  [AuditAction.ITEM_AVAILABILITY_CHANGED]: { label: "Availability changed", category: "Menu" },
  [AuditAction.ITEM_VISIBILITY_CHANGED]: { label: "Visibility changed", category: "Menu" },
  [AuditAction.MENU_ITEM_ARCHIVED]: { label: "Dish archived", category: "Menu" },
  [AuditAction.MENU_ITEM_RESTORED]: { label: "Dish restored", category: "Menu" },
  [AuditAction.MENU_BULK_ACTION]: { label: "Bulk menu action", category: "Menu" },
  [AuditAction.MENU_REORDERED]: { label: "Menu reordered", category: "Menu" },
  [AuditAction.CATEGORY_CHANGED]: { label: "Category changed", category: "Menu" },
  [AuditAction.DEAL_CHANGED]: { label: "Deal changed", category: "Menu" },

  [AuditAction.COUPON_CREATED]: { label: "Coupon created", category: "Menu" },
  [AuditAction.COUPON_UPDATED]: { label: "Coupon updated", category: "Menu" },
  [AuditAction.COUPON_DELETED]: { label: "Coupon deleted", category: "Menu" },

  [AuditAction.SETTINGS_CHANGED]: { label: "Settings changed", category: "Settings" },
  [AuditAction.STAFF_CREATED]: { label: "Staff member created", category: "Staff" },
  [AuditAction.STAFF_ROLE_CHANGED]: { label: "Staff role changed", category: "Staff" },
  [AuditAction.STAFF_DEACTIVATED]: { label: "Staff deactivated", category: "Staff" },
  [AuditAction.CUSTOMER_UPDATED]: { label: "Customer updated", category: "Staff" },
  [AuditAction.CUSTOMER_BLOCKED]: { label: "Customer blocked", category: "Staff" },
  [AuditAction.CUSTOMER_UNBLOCKED]: { label: "Customer unblocked", category: "Staff" },
  [AuditAction.BRANCH_CHANGED]: { label: "Branch changed", category: "Settings" },

  [AuditAction.LOGIN_FAILED]: { label: "Login failed", category: "Security" },
  [AuditAction.LOGIN_SUCCESS]: { label: "Login success", category: "Security" },
  [AuditAction.APPROVAL_PIN_FAILED]: { label: "Approval PIN failed", category: "Security" },

  [AuditAction.DINE_IN_EVENT]: { label: "Dine-in event", category: "Reservations" },
  [AuditAction.RESERVATION_CONFIRMED]: { label: "Reservation confirmed", category: "Reservations" },
  [AuditAction.RESERVATION_REJECTED]: { label: "Reservation rejected", category: "Reservations" },
  [AuditAction.RESERVATION_SEATED]: { label: "Reservation seated", category: "Reservations" },
  [AuditAction.RESERVATION_NO_SHOW_AUTO]: { label: "Reservation no-show (auto)", category: "Reservations" },
  [AuditAction.RESERVATION_EXPIRED_UNCONFIRMED]: {
    label: "Reservation expired (unconfirmed)",
    category: "Reservations",
  },
  [AuditAction.WAITLIST_ADDED]: { label: "Waitlist entry added", category: "Reservations" },
  [AuditAction.WAITLIST_SEATED]: { label: "Waitlist guest seated", category: "Reservations" },

  [AuditAction.SHIFT_OPENED]: { label: "Shift opened", category: "Cash" },
  [AuditAction.SHIFT_CLOSED]: { label: "Shift closed", category: "Cash" },
  [AuditAction.CASH_SHIFT_ADJUSTMENT]: { label: "Cash shift adjustment", category: "Cash" },
  [AuditAction.RIDER_CASH_COLLECTED]: { label: "Rider cash collected", category: "Cash" },
  [AuditAction.RIDER_CASH_SETTLED]: { label: "Rider cash settled", category: "Cash" },

  [AuditAction.POS_OFFLINE_SYNC_CREATED]: { label: "POS offline sync created", category: "System" },
  [AuditAction.POS_OFFLINE_SYNC_CONFLICT]: { label: "POS offline sync conflict", category: "System" },
  [AuditAction.POS_OFFLINE_SYNC_REJECTED]: { label: "POS offline sync rejected", category: "System" },
  [AuditAction.POS_OFFLINE_QUEUE_DISCARDED]: { label: "POS offline queue discarded", category: "System" },
  [AuditAction.POS_OFFLINE_LOGOUT_OVERRIDE]: { label: "POS offline logout override", category: "System" },

  [AuditAction.STOCK_ADJUSTED]: { label: "Stock adjusted", category: "Inventory" },
  [AuditAction.PURCHASE_VOIDED]: { label: "Purchase voided", category: "Inventory" },
};

// Legacy aliases → same meta as canonical
const LEGACY_ALIASES: Record<string, keyof typeof ACTION_META | AuditActionCode> = {
  ORDER_STATUS_CHANGED: AuditAction.ORDER_STATUS_CHANGED,
  ORDER_CANCELLED: AuditAction.ORDER_CANCELLED,
  ORDER_VOIDED: AuditAction.ORDER_VOIDED,
  REFUND_ISSUED: AuditAction.REFUND_ISSUED,
  DISCOUNT_APPLIED: AuditAction.DISCOUNT_APPLIED,
  ITEM_PRICE_CHANGED: AuditAction.ITEM_PRICE_CHANGED,
  ITEM_AVAILABILITY_CHANGED: AuditAction.ITEM_AVAILABILITY_CHANGED,
  ITEM_VISIBILITY_CHANGED: AuditAction.ITEM_VISIBILITY_CHANGED,
  MENU_ITEM_ARCHIVED: AuditAction.MENU_ITEM_ARCHIVED,
  MENU_ITEM_RESTORED: AuditAction.MENU_ITEM_RESTORED,
  MENU_BULK_ACTION: AuditAction.MENU_BULK_ACTION,
  MENU_REORDERED: AuditAction.MENU_REORDERED,
  CATEGORY_CHANGED: AuditAction.CATEGORY_CHANGED,
  DEAL_CHANGED: AuditAction.DEAL_CHANGED,
  SETTINGS_CHANGED: AuditAction.SETTINGS_CHANGED,
  STAFF_CREATED: AuditAction.STAFF_CREATED,
  STAFF_ROLE_CHANGED: AuditAction.STAFF_ROLE_CHANGED,
  STAFF_DEACTIVATED: AuditAction.STAFF_DEACTIVATED,
  CUSTOMER_UPDATED: AuditAction.CUSTOMER_UPDATED,
  CUSTOMER_BLOCKED: AuditAction.CUSTOMER_BLOCKED,
  CUSTOMER_UNBLOCKED: AuditAction.CUSTOMER_UNBLOCKED,
  BRANCH_CHANGED: AuditAction.BRANCH_CHANGED,
  LOGIN_FAILED: AuditAction.LOGIN_FAILED,
  LOGIN_SUCCESS: AuditAction.LOGIN_SUCCESS,
  APPROVAL_PIN_FAILED: AuditAction.APPROVAL_PIN_FAILED,
  DINE_IN_EVENT: AuditAction.DINE_IN_EVENT,
  SHIFT_OPENED: AuditAction.SHIFT_OPENED,
  SHIFT_CLOSED: AuditAction.SHIFT_CLOSED,
  CASH_SHIFT_ADJUSTMENT: AuditAction.CASH_SHIFT_ADJUSTMENT,
  RIDER_CASH_COLLECTED: AuditAction.RIDER_CASH_COLLECTED,
  RIDER_CASH_SETTLED: AuditAction.RIDER_CASH_SETTLED,
  POS_OFFLINE_SYNC_CREATED: AuditAction.POS_OFFLINE_SYNC_CREATED,
  POS_OFFLINE_SYNC_CONFLICT: AuditAction.POS_OFFLINE_SYNC_CONFLICT,
  POS_OFFLINE_SYNC_REJECTED: AuditAction.POS_OFFLINE_SYNC_REJECTED,
  POS_OFFLINE_QUEUE_DISCARDED: AuditAction.POS_OFFLINE_QUEUE_DISCARDED,
  POS_OFFLINE_LOGOUT_OVERRIDE: AuditAction.POS_OFFLINE_LOGOUT_OVERRIDE,
  PURCHASE_VOIDED: AuditAction.PURCHASE_VOIDED,
  "reservation.confirm": AuditAction.RESERVATION_CONFIRMED,
  "reservation.reject": AuditAction.RESERVATION_REJECTED,
  "reservation.seat": AuditAction.RESERVATION_SEATED,
  "reservation.no_show_auto": AuditAction.RESERVATION_NO_SHOW_AUTO,
  "reservation.expired_unconfirmed": AuditAction.RESERVATION_EXPIRED_UNCONFIRMED,
  WAITLIST_ADD: AuditAction.WAITLIST_ADDED,
  WAITLIST_SEATED: AuditAction.WAITLIST_SEATED,
  "table.walk_in_seat": AuditAction.RESERVATION_SEATED,
};

export function prettifyUnknownActionCode(code: string): string {
  const normalized = code.replace(/[._]/g, " ").replace(/_/g, " ").trim();
  if (!normalized) return "Unknown action";
  return normalized.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function resolveAuditActionMeta(action: string): AuditActionMeta {
  if (ACTION_META[action]) return ACTION_META[action];
  const alias = LEGACY_ALIASES[action];
  if (alias && ACTION_META[alias]) return ACTION_META[alias];
  return { label: prettifyUnknownActionCode(action), category: "System" };
}

export function auditActionsByCategory(): Record<AuditCategory, { code: string; label: string }[]> {
  const seen = new Set<string>();
  const out: Record<AuditCategory, { code: string; label: string }[]> = {
    Orders: [],
    Cash: [],
    Menu: [],
    Staff: [],
    Settings: [],
    Security: [],
    Reservations: [],
    Inventory: [],
    System: [],
  };
  const codes = [
    ...Object.values(AuditAction),
    ...Object.keys(LEGACY_ALIASES),
  ];
  for (const code of codes) {
    if (seen.has(code)) continue;
    seen.add(code);
    const meta = resolveAuditActionMeta(code);
    out[meta.category].push({ code, label: meta.label });
  }
  for (const cat of Object.keys(out) as AuditCategory[]) {
    out[cat].sort((a, b) => a.label.localeCompare(b.label));
  }
  return out;
}

export const AUDIT_ENTITY_TYPES = [
  "order",
  "order_item",
  "menu_item",
  "deal",
  "category",
  "user",
  "customer",
  "cash_shift",
  "rider_settlement",
  "store_settings",
  "branch",
  "coupon",
  "inventory_item",
  "Reservation",
  "TableSession",
  "WaitlistEntry",
] as const;
