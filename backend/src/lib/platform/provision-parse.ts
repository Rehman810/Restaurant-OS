import { DEFAULT_PLATFORM_TRIAL_DAYS } from "./platform-settings";
import type { ProvisionTenantInput } from "./provision";

const CURRENCY_SYMBOLS: Record<string, string> = {
  PKR: "Rs",
  INR: "₹",
  AED: "د.إ",
  SAR: "﷼",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

function optionalString(value: unknown) {
  if (value === undefined || value === null) return undefined;
  const s = String(value).trim();
  return s || undefined;
}

function optionalNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseBool(value: unknown, defaultValue: boolean) {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (value === true || value === "true" || value === "on" || value === 1 || value === "1") return true;
  if (value === false || value === "false" || value === "off" || value === 0 || value === "0") return false;
  return defaultValue;
}

export function parseProvisionTenantBody(body: Record<string, unknown>): ProvisionTenantInput {
  const currencyCode = optionalString(body.currencyCode)?.toUpperCase() || "PKR";
  const currencySymbol =
    optionalString(body.currencySymbol) || CURRENCY_SYMBOLS[currencyCode] || currencyCode;

  const city = optionalString(body.city);
  const seedDeliveryAreas = parseBool(body.seedDeliveryAreas, true);
  const seedStarterMenu = parseBool(body.seedStarterMenu, true);

  return {
    slug: String(body.slug || ""),
    displayName: String(body.displayName || ""),
    legalName: optionalString(body.legalName),
    ownerName: optionalString(body.ownerName),
    ownerEmail: optionalString(body.ownerEmail),
    ownerPhone: optionalString(body.ownerPhone),
    city,
    hostname: body.hostname === null ? null : optionalString(body.hostname),
    planSlug: optionalString(body.planSlug),
    trialDays: body.trialDays != null ? Number(body.trialDays) : DEFAULT_PLATFORM_TRIAL_DAYS,
    ownerPassword: optionalString(body.ownerPassword),
    isTest: parseBool(body.isTest, false),
    storeTagline: optionalString(body.storeTagline),
    timezone: optionalString(body.timezone) || "Asia/Karachi",
    currencyCode,
    currencySymbol,
    storePhone: optionalString(body.storePhone) || optionalString(body.phone),
    whatsapp: optionalString(body.whatsapp),
    address: optionalString(body.address),
    latitude: optionalNumber(body.latitude),
    longitude: optionalNumber(body.longitude),
    minimumOrder: optionalNumber(body.minimumOrder),
    taxEnabled: parseBool(body.taxEnabled, false),
    taxPercent: optionalNumber(body.taxPercent),
    branchAddressLine: optionalString(body.branchAddressLine) || optionalString(body.address),
    branchArea: optionalString(body.branchArea),
    branchCity: optionalString(body.branchCity) || city,
    acceptsOnlineOrders: parseBool(body.acceptsOnlineOrders, true),
    seedDeliveryAreas,
    seedStarterMenu,
    seedCity: city || (seedDeliveryAreas ? "Karachi" : undefined),
  };
}
