import { Role } from "@prisma/client";

/** Read-only mirror of frontend admin navigation access (no invented permissions). */
export function staffPermissionsSummary(): Record<
  Role,
  { pages: string[]; actions: string[] }
> {
  return {
    [Role.ADMIN]: {
      pages: [
        "Dashboard",
        "Analytics",
        "Kitchen",
        "POS",
        "Orders",
        "Staff",
        "Branches",
        "Settings",
        "Audit log",
        "Inventory",
        "Catalog",
      ],
      actions: [
        "Manage all staff",
        "Create admin (owner only)",
        "Change roles",
        "Reset passwords and 2FA",
        "Revoke sessions",
      ],
    },
    [Role.MANAGER]: {
      pages: ["Dashboard", "Kitchen", "POS", "Orders", "Customers", "Inventory (branch)"],
      actions: ["Create branch staff (non-manager)", "Edit branch staff", "Cannot edit admins"],
    },
    [Role.CASHIER]: {
      pages: ["Dashboard", "Kitchen", "POS", "Orders", "Customers"],
      actions: ["POS checkout", "View orders"],
    },
    [Role.CHEF]: {
      pages: ["Kitchen board"],
      actions: ["Update kitchen order status"],
    },
    [Role.WAITER]: {
      pages: ["Dine-in floor", "POS", "Kitchen"],
      actions: ["Table service", "POS orders"],
    },
    [Role.RIDER]: {
      pages: ["Delivery orders"],
      actions: ["Update delivery status"],
    },
    [Role.CUSTOMER]: { pages: [], actions: [] },
  };
}
