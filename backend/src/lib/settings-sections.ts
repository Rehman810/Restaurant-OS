import { Role } from "@prisma/client";

/** Admin settings IA — used for server-side access checks (aligned with frontend modules/settings/ia.ts). */
export const SETTINGS_SECTION_IDS = [
  "branding-theme",
  "contact-social",
  "reviews-testimonials",
  "banners",
  "hours-availability",
  "orders-delivery",
  "tax-receipts",
  "notifications",
  "integrations",
  "pos-controls-approvals",
  "devices-printing",
  "inventory",
  "costing",
  "alert-thresholds",
  "scheduled-reports",
  "my-account",
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTION_IDS)[number];

const ADMIN_ONLY: SettingsSectionId[] = SETTINGS_SECTION_IDS.filter((id) => id !== "my-account");

const MY_ACCOUNT: SettingsSectionId[] = ["my-account"];

export function rolesForSettingsSection(sectionId: string): Role[] | null {
  if (!SETTINGS_SECTION_IDS.includes(sectionId as SettingsSectionId)) return null;
  if (MY_ACCOUNT.includes(sectionId as SettingsSectionId)) {
    return [Role.ADMIN, Role.MANAGER];
  }
  return [Role.ADMIN];
}

export function assertSettingsSectionAccess(role: Role, sectionId: string): void {
  const allowed = rolesForSettingsSection(sectionId);
  if (!allowed) {
    throw Object.assign(new Error("Unknown settings section."), { status: 404 });
  }
  if (!allowed.includes(role)) {
    throw Object.assign(new Error("You do not have access to this settings section."), { status: 403 });
  }
}

export function listSettingsSectionsForRole(role: Role): SettingsSectionId[] {
  if (role === Role.ADMIN) return [...SETTINGS_SECTION_IDS];
  if (role === Role.MANAGER) return [...MY_ACCOUNT];
  return [];
}

export const SETTINGS_SECTION_LABELS: Record<SettingsSectionId, string> = {
  "branding-theme": "Branding and theme",
  "contact-social": "Contact and social",
  "reviews-testimonials": "Reviews and testimonials",
  banners: "Banners",
  "hours-availability": "Hours and availability",
  "orders-delivery": "Orders and delivery",
  "tax-receipts": "Tax and receipts",
  notifications: "Notifications",
  integrations: "Integrations",
  "pos-controls-approvals": "POS controls and approvals",
  "devices-printing": "Devices and printing",
  inventory: "Inventory",
  costing: "Costing",
  "alert-thresholds": "Alert thresholds",
  "scheduled-reports": "Scheduled reports",
  "my-account": "My account",
};

export { ADMIN_ONLY };
