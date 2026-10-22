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
};

const DEFAULTS: PlatformSettingsData = {
  trialDays: 14,
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
    ...(typeof o.trialDays === "number" ? { trialDays: o.trialDays } : {}),
    ...(typeof o.graceDays === "number" ? { graceDays: o.graceDays } : {}),
    ...(typeof o.cancelRetentionDays === "number" ? { cancelRetentionDays: o.cancelRetentionDays } : {}),
    ...(typeof o.supportEmail === "string" ? { supportEmail: o.supportEmail } : {}),
    ...(typeof o.invoiceLegalName === "string" ? { invoiceLegalName: o.invoiceLegalName } : {}),
    ...(typeof o.invoiceNtn === "string" ? { invoiceNtn: o.invoiceNtn } : {}),
    ...(Array.isArray(o.bankAccounts) ? { bankAccounts: o.bankAccounts as PlatformBankAccount[] } : {}),
    ...(typeof o.defaultPlanSlug === "string" ? { defaultPlanSlug: o.defaultPlanSlug } : {}),
    ...(Array.isArray(o.reservedSlugs) ? { reservedSlugs: o.reservedSlugs as string[] } : {}),
    ...(o.maintenance && typeof o.maintenance === "object" ? { maintenance: o.maintenance as PlatformSettingsData["maintenance"] } : {}),
  };
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
