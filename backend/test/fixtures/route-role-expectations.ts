import { Role } from "@prisma/client";
import { ADMIN_LIKE, ORDER_OPS } from "../../src/lib/roles";

/** Routes that intentionally allow anonymous access (review when adding new public APIs). */
export const PUBLIC_ROUTE_PREFIXES = [
  "GET /health",
  "GET /auth/csrf",
  "POST /auth/",
  "GET /branches/public",
  "GET /branches/default",
  "GET /categories",
  "GET /menu",
  "GET /deals",
  "GET /delivery-areas",
  "GET /settings/public",
  "GET /settings/reviews",
  "POST /coupons/validate",
  "GET /dine-in/",
  "POST /dine-in/",
  "POST /orders",
  "GET /orders/",
  "PATCH /orders/",
  "GET /invoices/",
] as const;

export type RouteRoleProbe = {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  allowed: Role[];
  body?: Record<string, unknown>;
};

/** Reviewable map for role matrix tests — extend when adding protected routes. */
export const ROUTE_ROLE_MATRIX: RouteRoleProbe[] = [
  { method: "GET", path: "/admin/blocks/", allowed: [Role.ADMIN] },
  { method: "GET", path: "/admin/audit-logs/", allowed: [...ADMIN_LIKE] },
  { method: "GET", path: "/settings/", allowed: [Role.ADMIN] },
  { method: "PATCH", path: "/settings/", allowed: [Role.ADMIN], body: {} },
  { method: "GET", path: "/admin/shifts/", allowed: [...ADMIN_LIKE] },
  { method: "GET", path: "/orders/board", allowed: [...ORDER_OPS] },
  { method: "GET", path: "/orders/", allowed: [...ORDER_OPS] },
  { method: "GET", path: "/admin/coupons/", allowed: [...ADMIN_LIKE] },
  { method: "GET", path: "/admin/reports/sales-intelligence", allowed: [...ADMIN_LIKE, Role.MANAGER] },
  { method: "GET", path: "/admin/reports/tax-collected", allowed: [...ADMIN_LIKE, Role.MANAGER] },
  { method: "GET", path: "/admin/staff/", allowed: [...ADMIN_LIKE] },
  { method: "GET", path: "/admin/rider-cash/summary", allowed: [...ADMIN_LIKE] },
  { method: "GET", path: "/admin/print-stations/", allowed: [...ORDER_OPS] },
  { method: "GET", path: "/admin/kot/orders/00000000-0000-4000-8000-000000000099", allowed: [...ORDER_OPS] },
  { method: "GET", path: "/rider/orders", allowed: [Role.RIDER] },
  { method: "POST", path: "/pos/", allowed: [...ADMIN_LIKE, Role.CASHIER, Role.WAITER], body: { items: [] } },
  { method: "GET", path: "/admin/approval/controls", allowed: [...ORDER_OPS] },
  { method: "GET", path: "/delivery-areas/all", allowed: [...ADMIN_LIKE] },
  { method: "GET", path: "/admin/areas/", allowed: [...ADMIN_LIKE] },
  { method: "GET", path: "/branches/", allowed: [Role.ADMIN, Role.MANAGER, Role.WAITER, Role.CHEF, Role.RIDER, Role.CASHIER] },
];

export type RouteRoleRule = {
  method: string;
  pathPattern: RegExp;
  roles: Role[];
};

/** @deprecated use ROUTE_ROLE_MATRIX */
export const ADMIN_ONLY_SAMPLES: RouteRoleRule[] = [];
