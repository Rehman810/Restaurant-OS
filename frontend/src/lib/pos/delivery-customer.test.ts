import { describe, expect, it } from "vitest";
import {
  getDeliveryFieldErrors,
  isWalkInCustomerName,
  resolvePosCustomerNameForCheckout,
} from "./delivery-customer";
import { posChargeBlockedReason } from "./checkout-helpers";

describe("isWalkInCustomerName", () => {
  it("treats walk-in variants as invalid for delivery", () => {
    expect(isWalkInCustomerName("Walk-in")).toBe(true);
    expect(isWalkInCustomerName(" walk in ")).toBe(true);
    expect(isWalkInCustomerName("")).toBe(true);
    expect(isWalkInCustomerName("Ali Khan")).toBe(false);
  });
});

describe("resolvePosCustomerNameForCheckout", () => {
  it("defaults pickup to Walk-in when empty", () => {
    expect(resolvePosCustomerNameForCheckout("PICKUP", "")).toBe("Walk-in");
  });
  it("keeps delivery name as entered", () => {
    expect(resolvePosCustomerNameForCheckout("DELIVERY", "Sara")).toBe("Sara");
  });
});

describe("delivery validation messages", () => {
  it("explains walk-in is not valid on delivery", () => {
    const errors = getDeliveryFieldErrors({
      deliveryAreaId: "a",
      deliveryAddress: "Street 1",
      customerName: "Walk-in",
      customerPhone: "03001234567",
    });
    expect(errors.name).toMatch(/Walk-in/i);
    expect(errors.phone).toBeUndefined();
  });

  it("surfaces first checkout blocker for delivery", () => {
    const msg = posChargeBlockedReason({
      linesEmpty: false,
      mode: "DELIVERY",
      tableSessionId: "",
      deliveryAreaId: "a",
      deliveryAddress: "x",
      customerName: "Walk-in",
      customerPhone: "03",
      payment: "CASH",
      shiftOpen: true,
      cashTendered: "",
      total: 100,
      splitRows: [],
      discountPercent: 0,
      discountReasonCode: "",
      discountReasonNote: "",
    });
    expect(msg).toMatch(/Walk-in/i);
  });
});
