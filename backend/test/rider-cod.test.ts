import { describe, expect, it } from "vitest";
import { FulfillmentType, PaymentMethod } from "@prisma/client";
import { isRiderCodOrder, roundMoney } from "../src/lib/rider-cod";

describe("[RCD-01] rider COD detection", () => {
  it("treats delivery non-card as COD", () => {
    expect(
      isRiderCodOrder({ fulfillmentType: FulfillmentType.DELIVERY, paymentMethod: null })
    ).toBe(true);
    expect(
      isRiderCodOrder({ fulfillmentType: FulfillmentType.DELIVERY, paymentMethod: PaymentMethod.CASH })
    ).toBe(true);
  });

  it("excludes pickup and card delivery", () => {
    expect(
      isRiderCodOrder({ fulfillmentType: FulfillmentType.PICKUP, paymentMethod: null })
    ).toBe(false);
    expect(
      isRiderCodOrder({
        fulfillmentType: FulfillmentType.DELIVERY,
        paymentMethod: PaymentMethod.CARD,
      })
    ).toBe(false);
  });

  it("rounds money to two decimals", () => {
    expect(roundMoney(10.005)).toBe(10.01);
    expect(roundMoney(10.004)).toBe(10);
  });
});
