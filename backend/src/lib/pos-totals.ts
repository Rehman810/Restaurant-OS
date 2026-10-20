import { PaymentMethod } from "@prisma/client";
import { applyOrderDiscount, quoteCharges, type ChargeSettings } from "./charges";
import type { TaxContext } from "./tax/types";
import { toMinorUnits } from "./money";

/** POS totals use HALF_UP on tax lines via tax/compute; order total is sum of minor parts (no extra cash rounding). */
export const POS_TOTAL_EPS_MINOR = 1;

export type PosTotalsLineInput = { price: number; quantity: number };

export type PosTotalsInput = {
  lines: PosTotalsLineInput[];
  deliveryCharge?: number;
  discountPercent?: number | null;
  discountAmount?: number | null;
  settings: ChargeSettings;
  taxCtx: TaxContext;
};

export type PosTotalsBreakdown = {
  subtotal: number;
  deliveryCharge: number;
  tax: number;
  service: number;
  discountAmount: number;
  total: number;
  subtotalMinor: number;
  totalMinor: number;
  taxEnabled: boolean;
  taxInclusive: boolean;
  roundingApplied: boolean;
};

export function posSubtotalFromLines(lines: PosTotalsLineInput[]) {
  const subtotalMinor = lines.reduce(
    (sum, l) => sum + toMinorUnits(l.price) * (l.quantity || 0),
    0
  );
  return { subtotal: subtotalMinor / 100, subtotalMinor };
}

export function computePosTotals(input: PosTotalsInput): PosTotalsBreakdown {
  const { subtotal, subtotalMinor } = posSubtotalFromLines(input.lines);
  const delivery = Number(input.deliveryCharge ?? 0);
  const quoted = quoteCharges(subtotal, delivery, input.settings, input.taxCtx);
  const discounted = applyOrderDiscount(
    quoted,
    input.discountPercent,
    input.discountAmount
  );
  const taxEnabled = Boolean(input.settings.taxEnabled);
  const taxInclusive = input.settings.taxEnabled
    ? Boolean(input.settings.pricesIncludeTax ?? input.settings.taxIncluded)
    : Boolean(input.settings.taxIncluded);
  const finalTotalMinor = toMinorUnits(discounted.total);
  return {
    subtotal,
    deliveryCharge: delivery,
    tax: quoted.tax,
    service: quoted.service,
    discountAmount: discounted.discountAmount,
    total: discounted.total,
    subtotalMinor,
    totalMinor: finalTotalMinor,
    taxEnabled,
    taxInclusive,
    /** No separate cash rounding line; totals are exact minor-unit arithmetic. */
    roundingApplied: false,
  };
}

export function resolveTaxContextForPayments(
  payments: { method: PaymentMethod; amount: number }[],
  fulfillmentType: TaxContext["fulfillmentType"]
): TaxContext {
  if (!payments.length) {
    return { fulfillmentType, paymentMethod: PaymentMethod.CASH };
  }
  const sorted = [...payments].sort((a, b) => b.amount - a.amount);
  return { fulfillmentType, paymentMethod: sorted[0]!.method };
}

export function clientTotalMatchesServer(
  clientTotal: number | null | undefined,
  serverTotalMinor: number
) {
  if (clientTotal == null || !Number.isFinite(Number(clientTotal))) return { ok: true as const };
  const clientMinor = toMinorUnits(clientTotal);
  if (Math.abs(clientMinor - serverTotalMinor) <= POS_TOTAL_EPS_MINOR) return { ok: true as const };
  return {
    ok: false as const,
    error: `Total mismatch: client ${clientTotal} vs server ${(serverTotalMinor / 100).toFixed(2)}.`,
  };
}
