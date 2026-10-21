import type { StoreSettings } from "@/lib/types";
import { pickSectionFromSettings } from "./section-fields";
import type { SettingsSectionId } from "./ia";

export const DANGEROUS_SETTING_KEYS = [
  "currencyCode",
  "currencySymbol",
  "timezone",
  "taxEnabled",
  "taxIncluded",
  "pricesIncludeTax",
  "taxPercent",
  "offlinePosEnabled",
  "forceClosed",
  "inventoryAutoHideMenu",
] as const;

const IMPACT: Record<(typeof DANGEROUS_SETTING_KEYS)[number], string> = {
  currencyCode: "Changing currency does not convert existing menu prices.",
  currencySymbol: "Receipts and the storefront will show a different currency symbol.",
  timezone: "Order times, reports, and scheduled emails will use the new timezone.",
  taxEnabled: "Tax invoicing and reports will change for new orders.",
  taxIncluded: "Checkout may show tax differently when prices include tax or not.",
  pricesIncludeTax: "What customers pay for menu prices can change in meaning.",
  taxPercent: "New orders will use the updated tax rate.",
  offlinePosEnabled: "Cashiers may or may not queue orders when offline.",
  forceClosed: "Online ordering stops until you turn this off. POS and dine-in keep working.",
  inventoryAutoHideMenu: "Items may be hidden from the menu when stock runs out.",
};

export function dangerousImpactsForSection(
  section: SettingsSectionId,
  current: StoreSettings,
  baseline: Record<string, unknown>
): { key: string; text: string }[] {
  const patch = pickSectionFromSettings(section, current);
  const impacts: { key: string; text: string }[] = [];
  for (const key of DANGEROUS_SETTING_KEYS) {
    if (patch[key] === undefined) continue;
    if (JSON.stringify(patch[key]) === JSON.stringify(baseline[key])) continue;
    impacts.push({ key, text: IMPACT[key] });
  }
  return impacts;
}
