import { describe, expect, it } from "vitest";
import { computeOrderTax, taxForQuote } from "../src/lib/tax/compute";
import type { TaxSettingsSlice } from "../src/lib/tax/types";

const base: TaxSettingsSlice = {
  taxEnabled: true,
  taxPercent: 5,
  pricesIncludeTax: false,
  taxRoundingRule: "HALF_UP",
};

describe("tax compute", () => {
  it("exclusive tax adds to line totals", () => {
    const r = computeOrderTax([{ priceAtOrder: 100, quantity: 2 }], base);
    expect(r.taxableAmount).toBe(200);
    expect(r.taxAmount).toBe(10);
    expect(r.taxInclusive).toBe(false);
  });

  it("inclusive tax extracts from gross", () => {
    const r = computeOrderTax(
      [{ priceAtOrder: 105, quantity: 1 }],
      { ...base, pricesIncludeTax: true, taxPercent: 5 }
    );
    expect(r.taxInclusive).toBe(true);
    expect(r.taxAmount).toBeCloseTo(5, 2);
    expect(r.taxableAmount).toBeCloseTo(100, 2);
  });

  it("quote uses fulfillment override rate", () => {
    const q = taxForQuote(200, {
      ...base,
      taxRatesByFulfillment: { DELIVERY: 10 },
    }, { fulfillmentType: "DELIVERY", paymentMethod: "CASH" });
    expect(q.tax).toBe(20);
  });

  it("snapshot fields are stable for an order", () => {
    const r = computeOrderTax([{ priceAtOrder: 50, quantity: 1 }], base, {
      fulfillmentType: "PICKUP",
      paymentMethod: "CARD",
    });
    expect(r.snapshot.rate).toBe(5);
    expect(r.snapshot.fulfillmentType).toBe("PICKUP");
    expect(r.lines[0].lineTaxRatePercent).toBe(5);
  });
});
