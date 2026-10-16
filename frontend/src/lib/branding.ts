import type { StoreSettings } from "./types";

export const DEFAULT_STORE_NAME = "Your Restaurant";
export const DEFAULT_STORE_TAGLINE = "Order in minutes";
export const PRODUCT_NAME = "Restaurant OS";
export const POWERED_BY_NAME = "Devsora";
export const POWERED_BY_URL = "https://devsora.pro";

export function storeDisplayName(settings?: Partial<Pick<StoreSettings, "storeName">> | null) {
  const name = settings?.storeName?.trim();
  return name || DEFAULT_STORE_NAME;
}

export function storeTagline(settings?: Partial<Pick<StoreSettings, "storeTagline">> | null) {
  const tag = settings?.storeTagline?.trim();
  return tag || DEFAULT_STORE_TAGLINE;
}

export function pickupLocation(settings?: Partial<Pick<StoreSettings, "storeName" | "address">> | null) {
  const addr = settings?.address?.trim() || "Restaurant address";
  return `${storeDisplayName(settings)} — ${addr}`;
}
