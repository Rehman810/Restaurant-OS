import {
  AlertTriangle,
  BarChart3,
  PieChart,
  Sun,
  Bike,
  Building2,
  ClipboardList,
  DoorClosed,
  Flame,
  LayoutDashboard,
  LayoutGrid,
  Map,
  MapPinned,
  Package,
  Receipt,
  Wallet,
  ScrollText,
  Settings,
  Tag,
  UserCog,
  Users,
  UtensilsCrossed,
  Printer,
} from "lucide-react";
import { Role } from "@/lib/types";

export type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };
export type NavSection = { title: string; items: NavItem[] };

export const ADMIN_NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/admin/reports/dish-costing", label: "Dish costing", icon: UtensilsCrossed },
      { href: "/admin/reports/menu-engineering", label: "Menu engineering", icon: PieChart },
      { href: "/admin/daily-summary", label: "Daily summary", icon: Sun },
      { href: "/admin/reports/tax", label: "Tax reports", icon: Receipt },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/admin/kitchen", label: "Kitchen", icon: Flame },
      { href: "/admin/kitchen/stations", label: "Print stations", icon: Printer },
      { href: "/admin/pos", label: "POS", icon: Receipt },
      { href: "/admin/orders", label: "Orders", icon: ClipboardList },
      { href: "/admin/shifts", label: "Shifts", icon: DoorClosed },
      { href: "/admin/sync-conflicts", label: "Sync conflicts", icon: AlertTriangle },
      { href: "/admin/riders/cash", label: "Rider cash", icon: Wallet },
      { href: "/admin/tracking", label: "Live tracking", icon: Map },
      { href: "/admin/dine-in", label: "Dine-in", icon: LayoutGrid },
    ],
  },
  {
    title: "Catalog",
    items: [
      { href: "/admin/menu", label: "Menu", icon: UtensilsCrossed },
      { href: "/admin/coupons", label: "Coupons", icon: Tag },
      { href: "/admin/inventory", label: "Inventory", icon: Package },
      { href: "/admin/areas", label: "Areas", icon: MapPinned },
    ],
  },
  {
    title: "People",
    items: [
      { href: "/admin/customers", label: "Customers", icon: Users },
      { href: "/admin/riders", label: "Riders", icon: Bike },
      { href: "/admin/staff", label: "Staff", icon: UserCog },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin/branches", label: "Branches", icon: Building2 },
      { href: "/admin/audit-log", label: "Audit log", icon: ScrollText },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const ADMIN_MOBILE_NAV: NavItem[] = [
  { href: "/admin", label: "Home", icon: LayoutDashboard },
  { href: "/admin/kitchen", label: "Kitchen", icon: Flame },
  { href: "/admin/pos", label: "POS", icon: Receipt },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

const MANAGER_NAV_SECTIONS: NavSection[] = ADMIN_NAV_SECTIONS.map((section) => ({
  ...section,
  items: section.items.filter(
    (item) => item.href !== "/admin/branches" && item.href !== "/admin/settings" && item.href !== "/admin/staff"
  ),
})).filter((section) => section.items.length > 0);

const WAITER_NAV_SECTIONS: NavSection[] = [
  {
    title: "Operations",
    items: [
      { href: "/admin/dine-in", label: "Dine-in floor", icon: LayoutGrid },
      { href: "/admin/pos", label: "POS", icon: Receipt },
      { href: "/admin/kitchen", label: "Kitchen", icon: Flame },
    ],
  },
];

export type NavOptions = { offlinePosEnabled?: boolean };

export function applyNavOptions(sections: NavSection[], opts?: NavOptions): NavSection[] {
  if (opts?.offlinePosEnabled !== true) {
    return sections.map((section) => ({
      ...section,
      items: section.items.filter((item) => item.href !== "/admin/sync-conflicts"),
    }));
  }
  return sections;
}

export function navSectionsForRole(role: Role, opts?: NavOptions): NavSection[] {
  if (role === "MANAGER") return applyNavOptions(MANAGER_NAV_SECTIONS, opts);
  if (role === "WAITER") return WAITER_NAV_SECTIONS;
  if (role === "CHEF") {
    return [
      {
        title: "Operations",
        items: [
          { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
          { href: "/admin/kitchen", label: "Kitchen", icon: Flame },
        ],
      },
    ];
  }
  if (role === "CASHIER") {
    return [
      {
        title: "Operations",
        items: [
          { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
          { href: "/admin/kitchen", label: "Kitchen", icon: Flame },
          { href: "/admin/pos", label: "POS", icon: Receipt },
          { href: "/admin/orders", label: "Orders", icon: ClipboardList },
        ],
      },
      {
        title: "People",
        items: [{ href: "/admin/customers", label: "Customers", icon: Users }],
      },
    ];
  }
  return applyNavOptions(ADMIN_NAV_SECTIONS, opts);
}

export const MOBILE_NAV_FOR_ROLE: Record<Role, NavItem[]> = {
  ADMIN: ADMIN_MOBILE_NAV,
  WAITER: [
    { href: "/admin/dine-in", label: "Floor", icon: LayoutGrid },
    { href: "/admin/pos", label: "POS", icon: Receipt },
    { href: "/admin/kitchen", label: "Kitchen", icon: Flame },
  ],
  MANAGER: [
    { href: "/admin", label: "Home", icon: LayoutDashboard },
    { href: "/admin/kitchen", label: "Kitchen", icon: Flame },
    { href: "/admin/pos", label: "POS", icon: Receipt },
    { href: "/admin/orders", label: "Orders", icon: ClipboardList },
    { href: "/admin/customers", label: "Customers", icon: Users },
  ],
  CHEF: [
    { href: "/admin", label: "Home", icon: LayoutDashboard },
    { href: "/admin/kitchen", label: "Kitchen", icon: Flame },
  ],
  CASHIER: [
    { href: "/admin", label: "Home", icon: LayoutDashboard },
    { href: "/admin/pos", label: "POS", icon: Receipt },
    { href: "/admin/kitchen", label: "Kitchen", icon: Flame },
    { href: "/admin/orders", label: "Orders", icon: ClipboardList },
    { href: "/admin/customers", label: "Customers", icon: Users },
  ],
  RIDER: [{ href: "/admin/orders", label: "Orders", icon: ClipboardList }],
  CUSTOMER: [],
};
