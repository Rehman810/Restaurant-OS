import { toMinorUnits } from "./money";
import { pricesAreTaxInclusive, taxForQuote } from "./tax/compute";
import type { TaxContext, TaxSettingsSlice } from "./tax/types";

export type ChargeSettings = TaxSettingsSlice & {
  serviceChargePercent?: unknown;
  serviceIncluded?: boolean | null;
};

function percentMinor(baseMinor: number, percent: number) {
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return Math.round((baseMinor * percent) / 100);
}

function includedMinor(baseMinor: number, percent: number) {
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  const net = Math.round(baseMinor / (1 + percent / 100));
  return baseMinor - net;
}

export function quoteCharges(
  subtotal: string | number,
  delivery: string | number,
  settings: ChargeSettings,
  ctx?: TaxContext
) {
  const subtotalMinor = toMinorUnits(subtotal);
  const deliveryMinor = toMinorUnits(delivery);
  const servicePercent = Number(settings.serviceChargePercent ?? 0);
  const serviceMinor = settings.serviceIncluded
    ? includedMinor(subtotalMinor, servicePercent)
    : percentMinor(subtotalMinor, servicePercent);

  let taxMinor: number;
  let taxableAmount: number | undefined;
  if (settings.taxEnabled) {
    const t = taxForQuote(Number(subtotal), settings, ctx);
    taxMinor = toMinorUnits(t.tax);
    taxableAmount = t.taxableAmount;
  } else {
    const taxPercent = Number(settings.taxPercent ?? 0);
    taxMinor = settings.taxIncluded
      ? includedMinor(subtotalMinor, taxPercent)
      : percentMinor(subtotalMinor, taxPercent);
  }

  const inclusive = settings.taxEnabled
    ? pricesAreTaxInclusive(settings)
    : Boolean(settings.taxIncluded);
  const added = (inclusive ? 0 : taxMinor) + (settings.serviceIncluded ? 0 : serviceMinor);
  const totalBeforeDiscount = subtotalMinor + deliveryMinor + added;
  return {
    tax: taxMinor / 100,
    service: serviceMinor / 100,
    total: totalBeforeDiscount / 100,
    totalMinor: totalBeforeDiscount,
    taxableAmount,
  };
}

export function applyOrderDiscount(
  quoted: ReturnType<typeof quoteCharges>,
  discountPercent?: number | null,
  discountAmount?: number | null
) {
  const totalMinor = quoted.totalMinor ?? toMinorUnits(quoted.total);
  let discountMinor = 0;
  const pct = Number(discountPercent ?? 0);
  if (Number.isFinite(pct) && pct > 0) {
    discountMinor = Math.round((totalMinor * pct) / 100);
  }
  const fixedMinor = toMinorUnits(discountAmount ?? 0);
  if (fixedMinor > 0) discountMinor = Math.max(discountMinor, fixedMinor);
  discountMinor = Math.min(discountMinor, totalMinor);
  return {
    discountAmount: discountMinor / 100,
    total: (totalMinor - discountMinor) / 100,
  };
}
