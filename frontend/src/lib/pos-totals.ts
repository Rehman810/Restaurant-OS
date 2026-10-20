/**
 * Client mirror of backend/src/lib/pos-totals.ts + charges quote/discount logic.
 * Used by POS UI only; server always recomputes on checkout.
 */
import { toMinorUnits } from "./money-units";

export type PosChargeSettings = {
  taxEnabled?: boolean;
  taxPercent?: unknown;
  taxIncluded?: boolean | null;
  pricesIncludeTax?: boolean | null;
  serviceChargePercent?: unknown;
  serviceIncluded?: boolean | null;
};

export type PosTaxContext = {
  fulfillmentType: string;
  paymentMethod: string;
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

function quoteChargesMinor(
  subtotal: number,
  delivery: number,
  settings: PosChargeSettings
) {
  const subtotalMinor = toMinorUnits(subtotal);
  const deliveryMinor = toMinorUnits(delivery);
  const servicePercent = Number(settings.serviceChargePercent ?? 0);
  const serviceMinor = settings.serviceIncluded
    ? includedMinor(subtotalMinor, servicePercent)
    : percentMinor(subtotalMinor, servicePercent);
  const taxPercent = Number(settings.taxPercent ?? 0);
  const taxMinor = settings.taxIncluded
    ? includedMinor(subtotalMinor, taxPercent)
    : percentMinor(subtotalMinor, taxPercent);
  const inclusive = settings.taxEnabled
    ? Boolean(settings.pricesIncludeTax ?? settings.taxIncluded)
    : Boolean(settings.taxIncluded);
  const added = (inclusive ? 0 : taxMinor) + (settings.serviceIncluded ? 0 : serviceMinor);
  const totalBeforeDiscount = subtotalMinor + deliveryMinor + added;
  return {
    taxMinor,
    serviceMinor,
    totalBeforeDiscountMinor: totalBeforeDiscount,
  };
}

function applyDiscountMinor(totalBeforeDiscountMinor: number, discountPercent?: number | null) {
  const pct = Number(discountPercent ?? 0);
  let discountMinor = 0;
  if (Number.isFinite(pct) && pct > 0) {
    discountMinor = Math.round((totalBeforeDiscountMinor * pct) / 100);
  }
  discountMinor = Math.min(discountMinor, totalBeforeDiscountMinor);
  return {
    discountMinor,
    totalMinor: totalBeforeDiscountMinor - discountMinor,
  };
}

export type PosTotalsLineInput = { price: number; quantity: number };

export function computePosTotalsClient(input: {
  lines: PosTotalsLineInput[];
  deliveryCharge?: number;
  discountPercent?: number | null;
  settings: PosChargeSettings;
}) {
  const subtotalMinor = input.lines.reduce(
    (sum, l) => sum + toMinorUnits(l.price) * (l.quantity || 0),
    0
  );
  const delivery = Number(input.deliveryCharge ?? 0);
  const quoted = quoteChargesMinor(subtotalMinor / 100, delivery, input.settings);
  const discounted = applyDiscountMinor(quoted.totalBeforeDiscountMinor, input.discountPercent);
  return {
    subtotal: subtotalMinor / 100,
    deliveryCharge: delivery,
    tax: quoted.taxMinor / 100,
    service: quoted.serviceMinor / 100,
    discountAmount: discounted.discountMinor / 100,
    total: discounted.totalMinor / 100,
    totalMinor: discounted.totalMinor,
    taxEnabled: Boolean(input.settings.taxEnabled),
  };
}

export function cashChangeDue(tendered: number, total: number) {
  const tenderedMinor = toMinorUnits(tendered);
  const totalMinor = toMinorUnits(total);
  return (tenderedMinor - totalMinor) / 100;
}
