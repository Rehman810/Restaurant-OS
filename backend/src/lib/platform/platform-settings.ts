import { basePrisma } from "../prisma-base";
import { withoutTenant } from "../restaurant-context";

export type PlatformBankAccount = { label: string; account: string };

export type PlatformSettingsData = {
  rootDomain?: string;
  trialDays?: number;
  graceDays?: number;
  cancelRetentionDays?: number;
  supportEmail?: string;
  invoiceLegalName?: string;
  invoiceNtn?: string;
  bankAccounts?: PlatformBankAccount[];
  defaultPlanSlug?: string;
  reservedSlugs?: string[];
  maintenance?: {
    active: boolean;
    message?: string;
    startsAt?: string;
    endsAt?: string;
  };
  require2FAForAllPlatformUsers?: boolean;
  dunning?: {
    enabled?: boolean;
    /** Days relative to invoice due date (negative = before due). */
    reminderOffsetsDays?: number[];
  };
  dunningEmailTemplates?: Partial<
    Record<"trialEnding" | "invoiceIssued" | "paymentOverdue" | "suspended", string>
  >;
  statusPage?: {
    headline?: string;
    incidents?: Array<{ id: string; title: string; status: string; updatedAt: string; body?: string }>;
  };
};

export const DEFAULT_DUNNING_OFFSETS_DAYS = [-3, 0, 3, 7];

export const DEFAULT_PLATFORM_TRIAL_DAYS = 15;

const DEFAULTS: PlatformSettingsData = {
  trialDays: DEFAULT_PLATFORM_TRIAL_DAYS,
  graceDays: 7,
  cancelRetentionDays: 30,
  defaultPlanSlug: "growth",
  supportEmail: "support@example.com",
  bankAccounts: [],
  reservedSlugs: ["www", "api", "admin", "platform", "app"],
};

function mergeSettings(raw: unknown): PlatformSettingsData {
  const base = { ...DEFAULTS };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  return {
    ...base,
    ...(typeof o.rootDomain === "string" ? { rootDomain: o.rootDomain } : {}),
    ...(typeof o.trialDays === "number"
      ? { trialDays: o.trialDays === 14 ? DEFAULT_PLATFORM_TRIAL_DAYS : o.trialDays }
      : {}),
    ...(typeof o.graceDays === "number" ? { graceDays: o.graceDays } : {}),
    ...(typeof o.cancelRetentionDays === "number" ? { cancelRetentionDays: o.cancelRetentionDays } : {}),
    ...(typeof o.supportEmail === "string" ? { supportEmail: o.supportEmail } : {}),
    ...(typeof o.invoiceLegalName === "string" ? { invoiceLegalName: o.invoiceLegalName } : {}),
    ...(typeof o.invoiceNtn === "string" ? { invoiceNtn: o.invoiceNtn } : {}),
    ...(Array.isArray(o.bankAccounts) ? { bankAccounts: o.bankAccounts as PlatformBankAccount[] } : {}),
    ...(typeof o.defaultPlanSlug === "string" ? { defaultPlanSlug: o.defaultPlanSlug } : {}),
    ...(Array.isArray(o.reservedSlugs) ? { reservedSlugs: o.reservedSlugs as string[] } : {}),
    ...(o.maintenance && typeof o.maintenance === "object" ? { maintenance: o.maintenance as PlatformSettingsData["maintenance"] } : {}),
    ...(typeof o.require2FAForAllPlatformUsers === "boolean"
      ? { require2FAForAllPlatformUsers: o.require2FAForAllPlatformUsers }
      : {}),
    ...(o.dunning && typeof o.dunning === "object" ? { dunning: o.dunning as PlatformSettingsData["dunning"] } : {}),
    ...(o.dunningEmailTemplates && typeof o.dunningEmailTemplates === "object"
      ? { dunningEmailTemplates: o.dunningEmailTemplates as PlatformSettingsData["dunningEmailTemplates"] }
      : {}),
    ...(o.statusPage && typeof o.statusPage === "object"
      ? { statusPage: o.statusPage as PlatformSettingsData["statusPage"] }
      : {}),
  };
}

export function dunningOffsetsFromSettings(data: PlatformSettingsData) {
  const raw = data.dunning?.reminderOffsetsDays;
  if (!Array.isArray(raw) || !raw.length) return [...DEFAULT_DUNNING_OFFSETS_DAYS];
  return raw.map((n) => Number(n)).filter((n) => Number.isFinite(n));
}

export async function loadPlatformSettings() {
  const row = await withoutTenant("load platform settings", () =>
    basePrisma.platformSettings.findUnique({ where: { id: "default" } })
  );
  if (!row) {
    return { version: 1, data: { ...DEFAULTS } };
  }
  return { version: row.version, data: mergeSettings(row.data) };
}

export async function updatePlatformSettings(expectedVersion: number, patch: Partial<PlatformSettingsData>) {
  return withoutTenant("update platform settings", async () => {
    const row = await basePrisma.platformSettings.findUnique({ where: { id: "default" } });
    if (!row) throw Object.assign(new Error("Settings not found."), { status: 404 });
    if (row.version !== expectedVersion) {
      throw Object.assign(new Error("These settings were changed elsewhere. Refresh and try again."), {
        status: 409,
        code: "STALE_SETTINGS",
      });
    }
    const merged = mergeSettings({ ...mergeSettings(row.data), ...patch });
    const updated = await basePrisma.platformSettings.update({
      where: { id: "default" },
      data: { version: { increment: 1 }, data: merged },
    });
    return { version: updated.version, data: mergeSettings(updated.data) };
  });
}

export async function loadTenantPaymentInstructions() {
  const { data } = await loadPlatformSettings();
  return {
    supportEmail: data.supportEmail,
    legalName: data.invoiceLegalName,
    ntn: data.invoiceNtn,
    bankAccounts: data.bankAccounts ?? [],
  };
}
