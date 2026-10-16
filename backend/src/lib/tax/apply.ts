import type { OrderLine } from "../order-lines";
import { computeOrderTax } from "./compute";
import type { TaxContext, TaxSettingsSlice } from "./types";

export function enrichLinesWithTax(lines: OrderLine[], settings: TaxSettingsSlice, ctx?: TaxContext) {
  const tax = computeOrderTax(
    lines.map((l) => ({ priceAtOrder: l.priceAtOrder, quantity: l.quantity })),
    settings,
    ctx
  );
  return {
    lines: lines.map((l, i) => ({
      ...l,
      lineTaxableAmount: tax.lines[i]?.lineTaxableAmount ?? 0,
      lineTaxAmount: tax.lines[i]?.lineTaxAmount ?? 0,
      lineTaxRatePercent: tax.lines[i]?.lineTaxRatePercent ?? 0,
    })),
    orderTax: {
      taxAmount: tax.taxAmount,
      taxableAmount: tax.taxableAmount,
      taxRatePercentSnap: tax.taxRatePercent,
      taxInclusiveSnap: tax.taxInclusive,
      taxSnapshotJson: tax.snapshot,
    },
  };
}
