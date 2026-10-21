import { Role } from "@prisma/client";
import type { StoreSettings } from "@prisma/client";

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
  channel: "email";
  /** Not controlled by role toggles */
  transactional?: boolean;
};

export const NOTIFICATION_EMAIL_ROWS: NotificationMatrixRow[] = [
  {
    id: "staff_new_order",
    label: "New order",
    description: "Staff alert when a customer order is created.",
    channel: "email",
  },
  {
    id: "rider_assigned",
    label: "Delivery assigned",
    description: "When a rider is assigned to an order.",
    channel: "email",
  },
  {
    id: "customer_placed",
    label: "Order received",
    description: "Customer confirmation that the order was placed (or auto-confirmed).",
    channel: "email",
  },
  {
    id: "customer_confirmed",
    label: "Order confirmed",
    description: "After staff confirms by phone.",
    channel: "email",
  },
  {
    id: "customer_preparing",
    label: "Preparing",
    description: "Kitchen started the order.",
    channel: "email",
  },
  {
    id: "customer_ready",
    label: "Ready / on the way",
    description: "Pickup ready or out for delivery.",
    channel: "email",
  },
  {
    id: "customer_delivered",
    label: "Delivered / collected",
    description: "Order completed.",
    channel: "email",
  },
  {
    id: "customer_cancelled",
    label: "Cancelled",
    description: "Order was cancelled.",
    channel: "email",
  },
  {
    id: "account_password_reset",
    label: "Password reset",
    description: "Always sent to the account that requested a reset.",
    channel: "email",
    transactional: true,
  },
  {
    id: "account_staff_welcome",
    label: "Staff invite",
    description: "Always sent when you create a staff login.",
    channel: "email",
    transactional: true,
  },
];

export const NOTIFY_ROLE_COLUMNS: {
  id: NotifyRoleColumn;
  label: string;
  settingKey?: EmailNotifySettingKey;
  prismaRole?: Role;
}[] = [
  { id: "admin", label: "Admin", settingKey: "emailNotifyAdmin", prismaRole: Role.ADMIN },
  { id: "manager", label: "Manager", settingKey: "emailNotifyManager", prismaRole: Role.MANAGER },
  { id: "chef", label: "Chef", settingKey: "emailNotifyChef", prismaRole: Role.CHEF },
  { id: "cashier", label: "Cashier", settingKey: "emailNotifyCashier", prismaRole: Role.CASHIER },
  { id: "waiter", label: "Waiter", settingKey: "emailNotifyWaiter", prismaRole: Role.WAITER },
  { id: "rider", label: "Rider", settingKey: "emailNotifyRider", prismaRole: Role.RIDER },
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

function settingOn(settings: Pick<StoreSettings, EmailNotifySettingKey>, key: EmailNotifySettingKey) {
  return Boolean(settings[key]);
}

export function notificationMatrixCell(
  rowId: string,
  role: NotifyRoleColumn,
  settings: Pick<StoreSettings, EmailNotifySettingKey>
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

/** Roles included in new-order staff emails (must match `staffOrderAlertEmails`). */
export function staffRolesForNewOrderEmail(settings: StoreSettings): Role[] {
  const roles: Role[] = [];
  for (const col of NOTIFY_ROLE_COLUMNS) {
    if (!col.prismaRole || !col.settingKey || !STAFF_ORDER_ROLES.includes(col.id)) continue;
    if (settingOn(settings, col.settingKey)) roles.push(col.prismaRole);
  }
  return roles;
}
