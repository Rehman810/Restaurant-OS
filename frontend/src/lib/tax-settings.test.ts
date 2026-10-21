import { describe, expect, it } from "vitest";
import { resolveTaxRatePercent, setTaxRateOverride } from "./tax-settings";

describe("tax-settings", () => {
  it("resolves payment override before fulfillment", () => {
    const rate = resolveTaxRatePercent(
      {
        taxPercent: 5,
        taxRatesByFulfillment: { DELIVERY: 10 },
        taxRatesByPayment: { CASH: 8 },
      },
      { fulfillmentType: "DELIVERY", paymentMethod: "CASH" }
    );
    expect(rate).toBe(8);
  });

  it("clears override when input is blank", () => {
    expect(setTaxRateOverride({ DELIVERY: 10 }, "DELIVERY", "")).toEqual({});
  });
});
