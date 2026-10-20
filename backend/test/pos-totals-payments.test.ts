import { describe, expect, it } from "vitest";
import { CashMovementType, PaymentMethod } from "@prisma/client";
import { computeExpectedCashMinor } from "../src/lib/cash-shift";
import { applyOrderDiscount, quoteCharges } from "../src/lib/charges";
import { toMinorUnits } from "../src/lib/money";
import { validatePosPayments } from "../src/lib/pos-payments";
import { clientTotalMatchesServer, computePosTotals } from "../src/lib/pos-totals";

const baseSettings = {
  taxEnabled: false,
  taxPercent: 0,
  taxIncluded: false,
  serviceChargePercent: 0,
  serviceIncluded: false,
};

describe("[POS-TOT-01] computePosTotals", () => {
  it("applies percent discount on subtotal + delivery + tax", () => {
    const totals = computePosTotals({
      lines: [{ price: 100, quantity: 2 }],
      deliveryCharge: 50,
      discountPercent: 10,
      settings: baseSettings,
      taxCtx: { fulfillmentType: "PICKUP", paymentMethod: PaymentMethod.CASH },
    });
    const quoted = quoteCharges(200, 50, baseSettings, {
      fulfillmentType: "PICKUP",
      paymentMethod: PaymentMethod.CASH,
    });
    const discounted = applyOrderDiscount(quoted, 10, null);
    expect(totals.total).toBe(discounted.total);
    expect(totals.discountAmount).toBe(discounted.discountAmount);
  });

  it("rejects client total mismatch", () => {
    const r = clientTotalMatchesServer(99, toMinorUnits(100));
    expect(r.ok).toBe(false);
  });
});

describe("[POS-PAY-01] split and tendered", () => {
  const totalMinor = toMinorUnits(240);

  it("accepts split cash + card", () => {
    const r = validatePosPayments(
      [
        { method: PaymentMethod.CASH, amount: 100 },
        { method: PaymentMethod.CARD, amount: 140 },
      ],
      totalMinor
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.cashDrawerMinor).toBe(toMinorUnits(100));
      expect(r.primaryMethod).toBe(PaymentMethod.CARD);
    }
  });

  it("validates tendered and change on cash", () => {
    const r = validatePosPayments(
      [{ method: PaymentMethod.CASH, amount: 240, tendered: 500, changeGiven: 260 }],
      totalMinor
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.cashDrawerMinor).toBe(toMinorUnits(240));
  });

  it("rejects tendered below cash amount", () => {
    const r = validatePosPayments(
      [{ method: PaymentMethod.CASH, amount: 240, tendered: 200 }],
      totalMinor
    );
    expect(r.ok).toBe(false);
  });

  it("rejects payment sum mismatch", () => {
    const r = validatePosPayments(
      [{ method: PaymentMethod.CASH, amount: 100 }],
      totalMinor
    );
    expect(r.ok).toBe(false);
  });
});

describe("[POS-PAY-02] shift expected cash with split", () => {
  it("counts only cash portion in drawer", () => {
    const minor = computeExpectedCashMinor(0, [
      { type: CashMovementType.SALE_CASH, amount: { toString: () => "100" } },
    ]);
    expect(minor).toBe(toMinorUnits(100));
  });
});
