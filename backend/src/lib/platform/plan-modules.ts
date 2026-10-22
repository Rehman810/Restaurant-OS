/**
 * Canonical plan module identifiers — keep in sync with platform & frontend plan-module-catalog.
 */
import type { ModuleAccessInput } from "./module-access";

export type PlanModuleId =
  | "pos"
  | "kitchen"
  | "catalog"
  | "inventory"
  | "dineIn"
  | "analytics"
  | "delivery"
  | "shifts"
  | "staff"
  | "dashboard"
  | "branches"
  | "auditLog";

export const PLAN_MODULE_DEFAULT_ON: PlanModuleId[] = ["pos", "dashboard", "auditLog"];

export type PlanMenuLink = { href: string; label: string };

export type PlanModuleDefinition = {
  id: PlanModuleId;
  label: string;
  description: string;
  menus: PlanMenuLink[];
  pathPrefixes: string[];
};

function pathPrefixesFromMenus(menus: PlanMenuLink[]): string[] {
  const prefixes = new Set<string>();
  for (const { href } of menus) {
    prefixes.add(href);
    if (href.includes("/catalog/")) prefixes.add("/admin/catalog/");
  }
  return [...prefixes].sort((a, b) => b.length - a.length);
}

function descriptionFromMenus(menus: PlanMenuLink[]) {
  return menus.map((m) => m.label).join(", ");
}

const MODULE_MENUS: { id: PlanModuleId; label: string; menus: PlanMenuLink[] }[] = [
  {
    id: "pos",
    label: "POS & orders",
    menus: [
      { href: "/admin/pos", label: "POS" },
      { href: "/admin/orders", label: "Orders" },
      { href: "/admin/sync-conflicts", label: "Sync conflicts" },
      { href: "/admin/customers", label: "Customers" },
    ],
  },
  {
    id: "kitchen",
    label: "Kitchen",
    menus: [
      { href: "/admin/kitchen", label: "Kitchen" },
      { href: "/admin/kitchen/stations", label: "Print stations" },
    ],
  },
  {
    id: "catalog",
    label: "Menu catalog",
    menus: [
      { href: "/admin/catalog/dishes", label: "Dishes" },
      { href: "/admin/catalog/offers", label: "Offers" },
      { href: "/admin/catalog/vouchers", label: "Coupons" },
      { href: "/admin/catalog/categories", label: "Categories" },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    menus: [{ href: "/admin/inventory", label: "Inventory" }],
  },
  {
    id: "dineIn",
    label: "Dine-in",
    menus: [{ href: "/admin/dine-in", label: "Dine-in" }],
  },
  {
    id: "analytics",
    label: "Analytics & reports",
    menus: [
      { href: "/admin/analytics", label: "Analytics" },
      { href: "/admin/reports/dish-costing", label: "Dish costing" },
      { href: "/admin/reports/menu-engineering", label: "Menu engineering" },
      { href: "/admin/daily-summary", label: "Daily summary" },
      { href: "/admin/reports/tax", label: "Tax reports" },
    ],
  },
  {
    id: "delivery",
    label: "Delivery & riders",
    menus: [
      { href: "/admin/areas", label: "Areas" },
      { href: "/admin/riders", label: "Riders" },
      { href: "/admin/riders/cash", label: "Rider cash" },
      { href: "/admin/tracking", label: "Live tracking" },
    ],
  },
  {
    id: "shifts",
    label: "Shifts",
    menus: [{ href: "/admin/shifts", label: "Shifts" }],
  },
  {
    id: "staff",
    label: "Staff & roles",
    menus: [{ href: "/admin/staff", label: "Staff" }],
  },
  {
    id: "dashboard",
    label: "Dashboard",
    menus: [{ href: "/admin", label: "Dashboard" }],
  },
  {
    id: "branches",
    label: "Branches",
    menus: [{ href: "/admin/branches", label: "Branches" }],
  },
  {
    id: "auditLog",
    label: "Audit log",
    menus: [{ href: "/admin/audit-log", label: "Audit log" }],
  },
];

export const PLAN_MODULES: PlanModuleDefinition[] = MODULE_MENUS.map((row) => ({
  ...row,
  description: descriptionFromMenus(row.menus),
  pathPrefixes: pathPrefixesFromMenus(row.menus),
}));

export const PLAN_MODULE_IDS = PLAN_MODULES.map((m) => m.id);

export type PlanModuleEntitlements = Partial<Record<PlanModuleId, ModuleAccessInput>>;
