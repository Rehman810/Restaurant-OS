import { toMinorUnits } from "./money";

export type ChargeSettings = {
  taxPercent?: unknown;
  taxIncluded?: boolean | null;
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
  settings: ChargeSettings
) {
  const subtotalMinor = toMinorUnits(subtotal);
  const deliveryMinor = toMinorUnits(delivery);
  const taxPercent = Number(settings.taxPercent ?? 0);
  const servicePercent = Number(settings.serviceChargePercent ?? 0);
  const taxMinor = settings.taxIncluded
    ? includedMinor(subtotalMinor, taxPercent)
    : percentMinor(subtotalMinor, taxPercent);
  const serviceMinor = settings.serviceIncluded
    ? includedMinor(subtotalMinor, servicePercent)
    : percentMinor(subtotalMinor, servicePercent);
  const added =
    (settings.taxIncluded ? 0 : taxMinor) + (settings.serviceIncluded ? 0 : serviceMinor);
  const totalBeforeDiscount = subtotalMinor + deliveryMinor + added;
  return {
    tax: taxMinor / 100,
    service: serviceMinor / 100,
    total: totalBeforeDiscount / 100,
    totalMinor: totalBeforeDiscount,
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
