import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Clock,
  ImageIcon,
  Package,
  Palette,
  Phone,
  Receipt,
  Shield,
  Star,
  Truck,
  UtensilsCrossed,
  UserCircle,
  Printer,
  Gauge,
  Mail,
  Plug,
} from "lucide-react";
import type { Role } from "@/lib/types";

export type SettingsSectionId =
  | "branding-theme"
  | "contact-social"
  | "reviews-testimonials"
  | "banners"
  | "hours-availability"
  | "orders-delivery"
  | "tax-receipts"
  | "notifications"
  | "integrations"
  | "pos-controls-approvals"
  | "devices-printing"
  | "inventory"
  | "costing"
  | "alert-thresholds"
  | "scheduled-reports"
  | "my-account";

export type SettingsGroupId =
  | "business"
  | "storefront"
  | "orders"
  | "pos-kitchen"
  | "stock-costing"
  | "alerts-reports"
  | "account";

export type SettingsSectionDef = {
  id: SettingsSectionId;
  groupId: SettingsGroupId;
  label: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Who may open this section in the admin UI */
  roles: Role[];
  /** Uses the main PATCH /settings form (sticky save in later tasks) */
  usesSettingsForm: boolean;
  searchTerms: string[];
};

export const SETTINGS_GROUPS: { id: SettingsGroupId; label: string }[] = [
  { id: "business", label: "Business" },
  { id: "storefront", label: "Storefront" },
  { id: "orders", label: "Orders" },
  { id: "pos-kitchen", label: "POS and kitchen" },
  { id: "stock-costing", label: "Stock and costing" },
  { id: "alerts-reports", label: "Alerts and reports" },
  { id: "account", label: "My account and security" },
];

export const SETTINGS_SECTIONS: SettingsSectionDef[] = [
  {
    id: "branding-theme",
    groupId: "business",
    label: "Branding and theme",
    title: "Branding and theme",
    description: "Name, logo, colors, currency, and timezone for your restaurant.",
    icon: Palette,
    roles: ["ADMIN"],
    usesSettingsForm: true,
    searchTerms: [
      "restaurant name",
      "tagline",
      "logo",
      "primary color",
      "accent color",
      "currency",
      "timezone",
      "footer",
    ],
  },
  {
    id: "contact-social",
    groupId: "business",
    label: "Contact and social",
    title: "Contact and social",
    description: "Phone, address, and social links shown on your storefront.",
    icon: Phone,
    roles: ["ADMIN"],
    usesSettingsForm: true,
    searchTerms: ["phone", "whatsapp", "address", "latitude", "longitude", "facebook", "instagram", "tiktok", "youtube"],
  },
  {
    id: "reviews-testimonials",
    groupId: "business",
    label: "Reviews and testimonials",
    title: "Reviews and testimonials",
    description: "Homepage reviews section, Google reviews, and customer quotes.",
    icon: Star,
    roles: ["ADMIN"],
    usesSettingsForm: true,
    searchTerms: ["reviews", "testimonials", "google place", "rating", "homepage reviews"],
  },
  {
    id: "banners",
    groupId: "storefront",
    label: "Banners",
    title: "Banners",
    description: "Promo images on your homepage carousel.",
    icon: ImageIcon,
    roles: ["ADMIN"],
    usesSettingsForm: false,
    searchTerms: ["banner", "carousel", "promo", "homepage image"],
  },
  {
    id: "hours-availability",
    groupId: "storefront",
    label: "Hours and availability",
    title: "Hours and availability",
    description: "When customers can order online and custom closed messages.",
    icon: Clock,
    roles: ["ADMIN"],
    usesSettingsForm: true,
    searchTerms: ["opening hours", "schedule", "closed", "force closed", "weekly"],
  },
  {
    id: "orders-delivery",
    groupId: "orders",
    label: "Orders and delivery",
    title: "Orders and delivery",
    description: "Minimum order, delivery rules, estimates, and order confirmation.",
    icon: Truck,
    roles: ["ADMIN"],
    usesSettingsForm: true,
    searchTerms: [
      "minimum order",
      "free delivery",
      "estimate",
      "auto confirm",
      "rider",
      "cash on delivery",
      "card",
    ],
  },
  {
    id: "tax-receipts",
    groupId: "orders",
    label: "Tax and receipts",
    title: "Tax and receipts",
    description: "Tax, service charge, invoicing, and receipt footer.",
    icon: Receipt,
    roles: ["ADMIN"],
    usesSettingsForm: true,
    searchTerms: ["tax", "service charge", "strn", "receipt", "invoicing", "ntn"],
  },
  {
    id: "notifications",
    groupId: "orders",
    label: "Notifications",
    title: "Notifications",
    description: "Email alerts by role for orders and deliveries.",
    icon: Bell,
    roles: ["ADMIN"],
    usesSettingsForm: true,
    searchTerms: ["email", "notify", "admin", "manager", "chef", "customer email"],
  },
  {
    id: "integrations",
    groupId: "orders",
    label: "Integrations",
    title: "Integrations",
    description: "SMTP, push, Google reviews, and WhatsApp server status plus Place ID.",
    icon: Plug,
    roles: ["ADMIN"],
    usesSettingsForm: true,
    searchTerms: ["smtp", "vapid", "google", "places", "whatsapp", "api", "env"],
  },
  {
    id: "pos-controls-approvals",
    groupId: "pos-kitchen",
    label: "POS controls and approvals",
    title: "POS controls and approvals",
    description: "Discount limits, manager approvals, and reason lists.",
    icon: Shield,
    roles: ["ADMIN"],
    usesSettingsForm: true,
    searchTerms: ["void", "refund", "discount", "approval", "cashier discount", "shift variance"],
  },
  {
    id: "devices-printing",
    groupId: "pos-kitchen",
    label: "Devices and printing",
    title: "Devices and printing",
    description: "Offline POS, device clock checks, kitchen printing, and order updates.",
    icon: Printer,
    roles: ["ADMIN"],
    usesSettingsForm: true,
    searchTerms: ["offline pos", "kitchen print", "push", "clock skew"],
  },
  {
    id: "inventory",
    groupId: "stock-costing",
    label: "Inventory",
    title: "Inventory",
    description: "How stock affects your menu on the storefront.",
    icon: Package,
    roles: ["ADMIN"],
    usesSettingsForm: true,
    searchTerms: ["auto-hide", "menu", "stock", "inventory"],
  },
  {
    id: "costing",
    groupId: "stock-costing",
    label: "Costing",
    title: "Costing",
    description: "Food cost targets for reports and menu engineering.",
    icon: UtensilsCrossed,
    roles: ["ADMIN"],
    usesSettingsForm: true,
    searchTerms: ["food cost", "target", "suspicious", "ingredient price"],
  },
  {
    id: "alert-thresholds",
    groupId: "alerts-reports",
    label: "Alert thresholds",
    title: "Alert thresholds",
    description: "When orders and shifts show as late or stale on dashboards.",
    icon: Gauge,
    roles: ["ADMIN"],
    usesSettingsForm: true,
    searchTerms: ["late", "stale", "duplicate order", "low rating", "shift open"],
  },
  {
    id: "scheduled-reports",
    groupId: "alerts-reports",
    label: "Scheduled reports",
    title: "Scheduled reports",
    description: "Analytics summary emails and insight thresholds.",
    icon: Mail,
    roles: ["ADMIN"],
    usesSettingsForm: true,
    searchTerms: ["analytics email", "weekly report", "insight", "week start"],
  },
  {
    id: "my-account",
    groupId: "account",
    label: "My account",
    title: "My account",
    description: "Approval PIN and sign-in security for your staff login.",
    icon: UserCircle,
    roles: ["ADMIN", "MANAGER"],
    usesSettingsForm: false,
    searchTerms: [
      "pin",
      "two-factor",
      "authenticator",
      "password",
      "sign out",
      "logout",
      "sessions",
      "profile",
      "approval pin",
    ],
  },
];

export const DEFAULT_SETTINGS_SECTION: SettingsSectionId = "branding-theme";

export const SETTINGS_SECTION_BY_ID: Record<SettingsSectionId, SettingsSectionDef> = Object.fromEntries(
  SETTINGS_SECTIONS.map((s) => [s.id, s])
) as Record<SettingsSectionId, SettingsSectionDef>;

/** Legacy `?tab=` values from the flat settings page */
export const LEGACY_SETTINGS_TAB_REDIRECT: Record<string, SettingsSectionId> = {
  store: "branding-theme",
  contact: "contact-social",
  notifications: "notifications",
  delivery: "orders-delivery",
  hours: "hours-availability",
  social: "contact-social",
  banners: "banners",
  inventory: "inventory",
  costing: "costing",
  controls: "pos-controls-approvals",
  security: "my-account",
  google: "integrations",
  integrations: "integrations",
};

export function isSettingsSectionId(value: string): value is SettingsSectionId {
  return value in SETTINGS_SECTION_BY_ID;
}

export function settingsPath(sectionId: SettingsSectionId): string {
  return `/admin/settings/${sectionId}`;
}

export function roleMayAccessSettingsSection(role: Role | undefined, sectionId: SettingsSectionId): boolean {
  if (!role) return false;
  const def = SETTINGS_SECTION_BY_ID[sectionId];
  return def.roles.includes(role);
}

export type SettingsSearchHit = {
  sectionId: SettingsSectionId;
  sectionLabel: string;
  label: string;
  anchorId: string;
};

/** Flat index for settings search (section + human labels) */
export const SETTINGS_SEARCH_INDEX: SettingsSearchHit[] = SETTINGS_SECTIONS.flatMap((section) =>
  section.searchTerms.map((term) => ({
    sectionId: section.id,
    sectionLabel: section.label,
    label: term.replace(/\b\w/g, (c) => c.toUpperCase()),
    anchorId: `setting-${section.id}-${term.replace(/\s+/g, "-")}`,
  }))
);

export function searchSettings(query: string, limit = 12): SettingsSearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: SettingsSearchHit[] = [];
  for (const section of SETTINGS_SECTIONS) {
    if (section.label.toLowerCase().includes(q)) {
      hits.push({
        sectionId: section.id,
        sectionLabel: section.label,
        label: section.label,
        anchorId: `section-${section.id}`,
      });
    }
  }
  for (const hit of SETTINGS_SEARCH_INDEX) {
    if (
      hit.label.toLowerCase().includes(q) ||
      hit.sectionLabel.toLowerCase().includes(q) ||
      hit.sectionId.includes(q)
    ) {
      hits.push(hit);
    }
    if (hits.length >= limit) break;
  }
  const seen = new Set<string>();
  return hits.filter((h) => {
    const key = `${h.sectionId}:${h.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}
