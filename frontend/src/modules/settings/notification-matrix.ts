import type { StoreSettings } from "@/lib/types";

export type NotifyRoleColumn =
  | "admin"
  | "manager"
  | "chef"
  | "cashier"
  | "waiter"
  | "rider"
  | "customer";

export type EmailNotifySettingKey =
  | "emailNotifyAdmin"
  | "emailNotifyManager"
  | "emailNotifyChef"
  | "emailNotifyCashier"
  | "emailNotifyWaiter"
  | "emailNotifyRider"
  | "emailNotifyCustomer";

export type MatrixCellState = "on" | "off" | "na" | "always";

export type NotificationMatrixRow = {
  id: string;
  label: string;
  description: string;
  transactional?: boolean;
};

export const NOTIFICATION_EMAIL_ROWS: NotificationMatrixRow[] = [
  {
    id: "staff_new_order",
    label: "New order",
    description: "Staff alert when a customer order is created.",
  },
  {
    id: "rider_assigned",
    label: "Delivery assigned",
    description: "When a rider is assigned to an order.",
  },
  {
    id: "customer_placed",
    label: "Order received",
    description: "Customer confirmation that the order was placed (or auto-confirmed).",
  },
  {
    id: "customer_confirmed",
    label: "Order confirmed",
    description: "After staff confirms by phone.",
  },
  {
    id: "customer_preparing",
    label: "Preparing",
    description: "Kitchen started the order.",
  },
  {
    id: "customer_ready",
    label: "Ready / on the way",
    description: "Pickup ready or out for delivery.",
  },
  {
    id: "customer_delivered",
    label: "Delivered / collected",
    description: "Order completed.",
  },
  {
    id: "customer_cancelled",
    label: "Cancelled",
    description: "Order was cancelled.",
  },
  {
    id: "account_password_reset",
    label: "Password reset",
    description: "Always sent to the account that requested a reset.",
    transactional: true,
  },
  {
    id: "account_staff_welcome",
    label: "Staff invite",
    description: "Always sent when you create a staff login.",
    transactional: true,
  },
];

export const NOTIFY_ROLE_COLUMNS: {
  id: NotifyRoleColumn;
  label: string;
  settingKey?: EmailNotifySettingKey;
}[] = [
  { id: "admin", label: "Admin", settingKey: "emailNotifyAdmin" },
  { id: "manager", label: "Manager", settingKey: "emailNotifyManager" },
  { id: "chef", label: "Chef", settingKey: "emailNotifyChef" },
  { id: "cashier", label: "Cashier", settingKey: "emailNotifyCashier" },
  { id: "waiter", label: "Waiter", settingKey: "emailNotifyWaiter" },
  { id: "rider", label: "Rider", settingKey: "emailNotifyRider" },
  { id: "customer", label: "Customer", settingKey: "emailNotifyCustomer" },
];

const STAFF_ORDER_ROLES: NotifyRoleColumn[] = ["admin", "manager", "chef", "cashier", "waiter"];
const CUSTOMER_LIFECYCLE_ROWS = new Set([
  "customer_placed",
  "customer_confirmed",
  "customer_preparing",
  "customer_ready",
  "customer_delivered",
  "customer_cancelled",
]);

function settingOn(settings: StoreSettings, key: EmailNotifySettingKey) {
  return Boolean(settings[key] ?? true);
}

export function notificationMatrixCell(
  rowId: string,
  role: NotifyRoleColumn,
  settings: StoreSettings
): MatrixCellState {
  if (rowId === "staff_new_order") {
    if (!STAFF_ORDER_ROLES.includes(role)) return "na";
    const col = NOTIFY_ROLE_COLUMNS.find((c) => c.id === role);
    return col?.settingKey && settingOn(settings, col.settingKey) ? "on" : "off";
  }
  if (rowId === "rider_assigned") {
    if (role !== "rider") return "na";
    return settingOn(settings, "emailNotifyRider") ? "on" : "off";
  }
  if (CUSTOMER_LIFECYCLE_ROWS.has(rowId)) {
    if (role !== "customer") return "na";
    return settingOn(settings, "emailNotifyCustomer") ? "on" : "off";
  }
  return "na";
}

export function withEmailNotifyDefaults(settings: StoreSettings): StoreSettings {
  return {
    ...settings,
    emailNotifyAdmin: settings.emailNotifyAdmin ?? true,
    emailNotifyManager: settings.emailNotifyManager ?? true,
    emailNotifyChef: settings.emailNotifyChef ?? true,
    emailNotifyCashier: settings.emailNotifyCashier ?? true,
    emailNotifyWaiter: settings.emailNotifyWaiter ?? true,
    emailNotifyRider: settings.emailNotifyRider ?? true,
    emailNotifyCustomer: settings.emailNotifyCustomer ?? true,
  };
}
