import type { TaxContext, TaxLineInput, TaxOrderResult, TaxRoundingRule, TaxSettingsSlice } from "./types";
import { toMinorUnits } from "../money";

function parseRateMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) out[k] = n;
  }
  return out;
}

export function resolveTaxRatePercent(settings: TaxSettingsSlice, ctx?: TaxContext) {
  const byPay = parseRateMap(settings.taxRatesByPayment);
  const byFulfillment = parseRateMap(settings.taxRatesByFulfillment);
  const pay = ctx?.paymentMethod;
  const fulfillment = ctx?.fulfillmentType;
  if (pay && byPay[pay] != null) return byPay[pay]!;
  if (fulfillment && byFulfillment[fulfillment] != null) return byFulfillment[fulfillment]!;
  return Number(settings.taxPercent ?? 0);
}

export function pricesAreTaxInclusive(settings: TaxSettingsSlice) {
  if (settings.taxEnabled) {
    return Boolean(settings.pricesIncludeTax ?? settings.taxIncluded);
  }
  return Boolean(settings.taxIncluded);
}

function percentMinor(baseMinor: number, percent: number) {
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return Math.round((baseMinor * percent) / 100);
}

function includedMinor(baseMinor: number, percent: number) {
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  const net = Math.round(baseMinor / (1 + percent / 100));
  return baseMinor - net;
}

export function applyRounding(minor: number, rule: TaxRoundingRule) {
  const major = minor / 100;
  switch (rule) {
    case "FLOOR":
      return Math.floor(major * 100);
    case "CEILING":
      return Math.ceil(major * 100);
    case "HALF_DOWN":
      return Math.round(major * 100 - 0.0001);
    case "HALF_UP":
    default:
      return Math.round(major * 100);
  }
}

export function computeOrderTax(
  lines: TaxLineInput[],
  settings: TaxSettingsSlice,
  ctx?: TaxContext
): TaxOrderResult {
  const enabled = Boolean(settings.taxEnabled);
  const rate = enabled ? resolveTaxRatePercent(settings, ctx) : Number(settings.taxPercent ?? 0);
  const inclusive = pricesAreTaxInclusive(settings);
  const rule = (settings.taxRoundingRule || "HALF_UP") as TaxRoundingRule;

  const lineResults: TaxOrderResult["lines"] = [];
  let taxMinorTotal = 0;
  let taxableMinorTotal = 0;

  for (const line of lines) {
    const lineMinor = toMinorUnits(line.priceAtOrder * line.quantity);
    let taxMinor = 0;
    let taxableMinor = lineMinor;
    if (rate > 0) {
      if (inclusive) {
        taxMinor = includedMinor(lineMinor, rate);
        taxableMinor = lineMinor - taxMinor;
      } else {
        taxableMinor = lineMinor;
        taxMinor = percentMinor(taxableMinor, rate);
      }
    }
    taxMinorTotal += taxMinor;
    taxableMinorTotal += taxableMinor;
    lineResults.push({
      lineTaxableAmount: taxableMinor / 100,
      lineTaxAmount: taxMinor / 100,
      lineTaxRatePercent: rate,
    });
  }

  taxMinorTotal = applyRounding(taxMinorTotal, rule);

  return {
    taxAmount: taxMinorTotal / 100,
    taxableAmount: taxableMinorTotal / 100,
    taxRatePercent: rate,
    taxInclusive: inclusive,
    lines: lineResults,
    snapshot: {
      taxEnabled: enabled,
      rate,
      inclusive,
      rule,
      fulfillmentType: ctx?.fulfillmentType ?? null,
      paymentMethod: ctx?.paymentMethod ?? null,
      computedAt: new Date().toISOString(),
    },
  };
}

/** Merge tax into quoteCharges-style totals (tax on subtotal only; service unchanged). */
export function taxForQuote(
  subtotal: number,
  settings: TaxSettingsSlice,
  ctx?: TaxContext
) {
  const tax = computeOrderTax([{ priceAtOrder: subtotal, quantity: 1 }], settings, ctx);
  const added = tax.taxInclusive ? 0 : tax.taxAmount;
  return { tax: tax.taxAmount, taxableAmount: tax.taxableAmount, added, meta: tax };
}
