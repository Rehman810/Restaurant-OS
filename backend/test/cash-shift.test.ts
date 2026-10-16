import { describe, expect, it } from "vitest";
import { CashMovementType } from "@prisma/client";
import {
  buildShiftReport,
  computeExpectedCashMinor,
  sumDenominations,
} from "../src/lib/cash-shift";

describe("[SHF-01] cash shift math", () => {
  it("sums denomination counts", () => {
    expect(sumDenominations({ "1000": 2, "500": 1, coins: 50 })).toBe(2550);
  });

  it("computes expected cash from movements", () => {
    const minor = computeExpectedCashMinor(1000, [
      { type: CashMovementType.SALE_CASH, amount: { toString: () => "500" } },
      { type: CashMovementType.PAID_IN, amount: { toString: () => "200" } },
      { type: CashMovementType.REFUND_CASH, amount: { toString: () => "100" } },
      { type: CashMovementType.PAID_OUT, amount: { toString: () => "50" } },
    ]);
    expect(minor).toBe(155000);
    const report = buildShiftReport(
      {
        openingCash: { toString: () => "1000" },
        movements: [
          { type: CashMovementType.SALE_CASH, amount: { toString: () => "500" } },
          { type: CashMovementType.PAID_IN, amount: { toString: () => "200" } },
          { type: CashMovementType.REFUND_CASH, amount: { toString: () => "100" } },
          { type: CashMovementType.PAID_OUT, amount: { toString: () => "50" } },
        ],
      },
      1550
    );
    expect(report.expectedCash).toBe(1550);
    expect(report.variance).toBe(0);
  });
});
