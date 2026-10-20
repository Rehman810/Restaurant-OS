export type AppRole = "ADMIN" | "MANAGER" | "CASHIER" | "CHEF" | "RIDER" | "CUSTOMER" | "ANONYMOUS";

export type AccessAction =
  | "dashboard"
  | "analytics"
  | "kitchen"
  | "pos"
  | "orders.read"
  | "orders.status"
  | "orders.assign"
  | "customers.read"
  | "customers.block"
  | "menu.write"
  | "areas.write"
  | "staff"
  | "settings"
  | "rider.own";

const MATRIX: Record<AccessAction, AppRole[]> = {
  dashboard: ["ADMIN", "MANAGER", "CASHIER"],
  analytics: ["ADMIN", "MANAGER"],
  kitchen: ["ADMIN", "MANAGER", "CHEF", "CASHIER"],
  pos: ["ADMIN", "MANAGER", "CASHIER"],
  "orders.read": ["ADMIN", "MANAGER", "CHEF", "CASHIER"],
  "orders.status": ["ADMIN", "MANAGER", "CHEF", "CASHIER"],
  "orders.assign": ["ADMIN", "MANAGER"],
  "customers.read": ["ADMIN", "MANAGER", "CASHIER"],
  "customers.block": ["ADMIN"],
  "menu.write": ["ADMIN", "MANAGER"],
  "areas.write": ["ADMIN", "MANAGER"],
  staff: ["ADMIN"],
  settings: ["ADMIN"],
  "rider.own": ["RIDER"],
};

export function canAccess(role: AppRole, action: AccessAction) {
  return MATRIX[action].includes(role);
}

export const ACCESS_MATRIX = MATRIX;
