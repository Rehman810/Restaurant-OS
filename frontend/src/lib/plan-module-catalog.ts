/**
 * Canonical plan modules + admin sidebar menu links (same labels as navigation.ts).
 * Keep in sync with backend & platform plan-modules.ts menu lists.
 */
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

/** When a plan omits a module flag, these are treated as enabled. */
export const PLAN_MODULE_DEFAULT_ON: PlanModuleId[] = ["pos", "dashboard", "auditLog"];

export type PlanMenuLink = { href: string; label: string };

export type PlanModuleDefinition = {
  id: PlanModuleId;
  /** Group title on platform Plans UI */
  label: string;
  menus: PlanMenuLink[];
};

export const PLAN_MODULES: PlanModuleDefinition[] = [
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

export const PLAN_MODULE_IDS = PLAN_MODULES.map((m) => m.id);

/** Admin paths always visible regardless of plan modules. */
export const PLAN_EXEMPT_ADMIN_PATHS = ["/admin/billing", "/admin/settings"];

function pathPrefixesFromMenus(menus: PlanMenuLink[]): string[] {
  const prefixes = new Set<string>();
  for (const { href } of menus) {
    prefixes.add(href);
    if (href.includes("/catalog/")) prefixes.add("/admin/catalog/");
  }
  return [...prefixes].sort((a, b) => b.length - a.length);
}

export const PLAN_MODULE_PATH_PREFIXES: Record<PlanModuleId, string[]> = Object.fromEntries(
  PLAN_MODULES.map((m) => [m.id, pathPrefixesFromMenus(m.menus)])
) as Record<PlanModuleId, string[]>;

const HREF_TO_MODULE = new Map<string, PlanModuleId>();
for (const mod of PLAN_MODULES) {
  for (const menu of mod.menus) {
    HREF_TO_MODULE.set(menu.href, mod.id);
  }
}

export function planModuleMenuLabels(id: PlanModuleId): string[] {
  return PLAN_MODULES.find((m) => m.id === id)?.menus.map((x) => x.label) ?? [];
}

function isPlanExemptAdminPath(path: string): boolean {
  return PLAN_EXEMPT_ADMIN_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

export function planModuleForNavHref(href: string): PlanModuleId | null {
  let path = href.split("?")[0];
  if (path === "/admin/") path = "/admin";
  if (isPlanExemptAdminPath(path)) return null;
  const exact = HREF_TO_MODULE.get(path);
  if (exact) return exact;
  for (const mod of PLAN_MODULES) {
    for (const prefix of PLAN_MODULE_PATH_PREFIXES[mod.id]) {
      if (path === prefix || path.startsWith(`${prefix}/`) || (prefix.endsWith("/") && path.startsWith(prefix))) {
        return mod.id;
      }
    }
  }
  return null;
}
