import { describe, expect, it } from "vitest";
import { posChargeBlockedReason, suggestQuickTenders } from "./checkout-helpers";

describe("suggestQuickTenders", () => {
  it("includes exact and next round amounts", () => {
    const { exact, amounts } = suggestQuickTenders(240);
    expect(exact).toBe(240);
    expect(amounts).toContain(500);
  });
});

describe("posChargeBlockedReason", () => {
  const base = {
    linesEmpty: false,
    mode: "PICKUP" as const,
    tableSessionId: "",
    deliveryAreaId: "a",
    deliveryAddress: "",
    customerName: "Walk-in",
    customerPhone: "",
    payment: "CASH" as const,
    shiftOpen: true,
    cashTendered: "",
    total: 100,
    splitRows: [],
    discountPercent: 0,
    discountReasonCode: "",
    discountReasonNote: "",
  };

  it("blocks empty cart", () => {
    expect(posChargeBlockedReason({ ...base, linesEmpty: true })).toMatch(/cart/i);
  });

  it("blocks dine-in without table", () => {
    expect(
      posChargeBlockedReason({ ...base, mode: "DINE_IN", tableSessionId: "" })
    ).toMatch(/table/i);
  });

  it("blocks insufficient cash", () => {
    expect(
      posChargeBlockedReason({ ...base, cashTendered: "50", total: 100 })
    ).toMatch(/short/i);
  });
});
