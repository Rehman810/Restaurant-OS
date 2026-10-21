import type { StoreSettings } from "@prisma/client";
import { prisma } from "./prisma";
import { staffRolesForNewOrderEmail } from "./notification-email-matrix";
import { getStoreSettings } from "./settings-data";

export const DEFAULT_STORE_NAME = "";
export const DEFAULT_STORE_TAGLINE = "Order in minutes";
export const PRODUCT_NAME = "Restaurant OS";
export const POWERED_BY_NAME = "Devsora";
export const POWERED_BY_URL = "https://devsora.pro";

export function storeNameFrom(settings?: Partial<Pick<StoreSettings, "storeName">> | null) {
  const name = settings?.storeName?.trim();
  return name || DEFAULT_STORE_NAME;
}

export async function getEmailBranding() {
  const settings = await getStoreSettings();
  return {
    storeName: storeNameFrom(settings) || "Restaurant",
    storeTagline: settings.storeTagline?.trim() || DEFAULT_STORE_TAGLINE,
    emailNotifyAdmin: settings.emailNotifyAdmin,
    emailNotifyManager: settings.emailNotifyManager,
    emailNotifyChef: settings.emailNotifyChef,
    emailNotifyCashier: settings.emailNotifyCashier,
    emailNotifyWaiter: settings.emailNotifyWaiter,
    emailNotifyRider: settings.emailNotifyRider,
    emailNotifyCustomer: settings.emailNotifyCustomer,
    currencyCode: settings.currencyCode,
    currencySymbol: settings.currencySymbol,
  };
}

/** Recipients for new-order staff alert emails (respects per-role toggles in settings). */
export async function staffOrderAlertEmails(settings: StoreSettings) {
  const roles = staffRolesForNewOrderEmail(settings);

  const staff =
    roles.length > 0
      ? await prisma.user.findMany({
          where: { role: { in: roles }, isActive: true },
          select: { email: true },
        })
      : [];

  const extra = settings.emailNotifyAdmin
    ? ([process.env.NOTIFY_EMAIL, process.env.ADMIN_EMAIL].filter(Boolean) as string[])
    : [];
  return [...new Set([...staff.map((s) => s.email), ...extra])];
}
