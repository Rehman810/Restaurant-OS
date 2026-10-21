import type { StoreSettings } from "./types";

const FULFILLMENT_KEYS = ["DELIVERY", "PICKUP", "DINE_IN"] as const;
const PAYMENT_KEYS = ["CASH", "CARD"] as const;

export function parseTaxRateMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) out[k] = n;
  }
  return out;
}

export function resolveTaxRatePercent(
  settings: Pick<StoreSettings, "taxPercent" | "taxRatesByFulfillment" | "taxRatesByPayment">,
  ctx?: { fulfillmentType?: string; paymentMethod?: string }
) {
  const byPay = parseTaxRateMap(settings.taxRatesByPayment);
  const byFulfillment = parseTaxRateMap(settings.taxRatesByFulfillment);
  if (ctx?.paymentMethod && byPay[ctx.paymentMethod] != null) return byPay[ctx.paymentMethod]!;
  if (ctx?.fulfillmentType && byFulfillment[ctx.fulfillmentType] != null) {
    return byFulfillment[ctx.fulfillmentType]!;
  }
  return Number(settings.taxPercent ?? 0);
}

export function setTaxRateOverride(
  map: Record<string, number> | undefined,
  key: string,
  raw: string
): Record<string, number> {
  const next = { ...parseTaxRateMap(map) };
  const trimmed = raw.trim();
  if (!trimmed) {
    delete next[key];
    return next;
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return next;
  next[key] = n;
  return next;
}

export const TAX_ROUNDING_OPTIONS = [
  { value: "HALF_UP", label: "Half up (default)" },
  { value: "HALF_DOWN", label: "Half down" },
  { value: "FLOOR", label: "Floor" },
  { value: "CEILING", label: "Ceiling" },
] as const;

export { FULFILLMENT_KEYS, PAYMENT_KEYS };
