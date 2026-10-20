import { describe, expect, it } from "vitest";
import { cashChangeDue, computePosTotalsClient } from "./pos-totals";

describe("computePosTotalsClient", () => {
  it("sums lines and applies discount", () => {
    const t = computePosTotalsClient({
      lines: [{ price: 120, quantity: 2 }],
      deliveryCharge: 0,
      discountPercent: 10,
      settings: { taxEnabled: false, taxPercent: 0, taxIncluded: false },
    });
    expect(t.subtotal).toBe(240);
    expect(t.total).toBe(216);
  });
});

describe("cashChangeDue", () => {
  it("computes change", () => {
    expect(cashChangeDue(500, 240)).toBe(260);
  });
});
