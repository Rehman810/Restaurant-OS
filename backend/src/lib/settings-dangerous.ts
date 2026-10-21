/** Settings changes that need explicit admin confirmation before save. */
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

export type DangerousSettingKey = (typeof DANGEROUS_SETTING_KEYS)[number];

const IMPACT: Record<DangerousSettingKey, string> = {
  currencyCode: "Changing currency does not convert existing menu prices. Receipts and reports will use the new symbol.",
  currencySymbol: "Receipts and the storefront will show a different currency symbol.",
  timezone: "Order times, reports, and scheduled emails will shift to the new timezone.",
  taxEnabled: "Turning tax invoicing on or off changes how orders are recorded for tax reports.",
  taxIncluded: "Customers may see different tax lines at checkout when tax is included or added on top.",
  pricesIncludeTax: "Menu prices customers pay can change meaning when tax is included in displayed prices.",
  taxPercent: "Checkout and receipts will use the new tax rate on new orders.",
  offlinePosEnabled: "Cashiers may or may not queue orders when the internet drops.",
  forceClosed: "Online ordering stops immediately until you turn this off. POS and dine-in are not affected.",
  inventoryAutoHideMenu: "Menu items may disappear from the storefront when stock runs out.",
};

export function dangerousImpactText(key: DangerousSettingKey): string {
  return IMPACT[key];
}

export function listDangerousChanges(
  current: Record<string, unknown>,
  patch: Record<string, unknown>
): DangerousSettingKey[] {
  const changed: DangerousSettingKey[] = [];
  for (const key of DANGEROUS_SETTING_KEYS) {
    if (patch[key] === undefined) continue;
    const cur = current[key];
    const next = patch[key];
    if (JSON.stringify(cur) !== JSON.stringify(next)) {
      changed.push(key);
    }
  }
  return changed;
}

export function isRestorableSettingsChange(keys: string[]): boolean {
  return keys.every((k) => !DANGEROUS_SETTING_KEYS.includes(k as DangerousSettingKey));
}
