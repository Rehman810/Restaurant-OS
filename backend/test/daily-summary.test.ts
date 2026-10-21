import { describe, expect, it } from "vitest";
import { computeAvgOrderValue } from "../src/lib/metrics/definitions";
import { dailySummaryToCsv } from "../src/lib/reports/daily-summary-csv";
import { buildShiftReport } from "../src/lib/cash-shift";
import { CashMovementType } from "@prisma/client";

describe("daily summary metrics", () => {
  it("AOV uses collected / completed", () => {
    expect(computeAvgOrderValue(8550, 7)).toBeCloseTo(1221.43, 1);
    expect(computeAvgOrderValue(1000, 4)).toBe(250);
  });

  it("CSV export includes BOM and escapes formula injection", () => {
    const csv = dailySummaryToCsv({
      meta: {
        date: "2026-10-21",
        timezone: "Asia/Karachi",
        storeDayStart: "",
        storeDayEnd: "",
        generatedAt: "2026-10-21T12:00:00Z",
        status: "provisional",
        finalReasons: [],
        branch: { id: "b", name: "=evil" },
        definitions: {} as never,
        statusHelp: "",
      },
      needsAttention: [],
      money: {
        booked: { value: 1, previousYesterday: 0, previousSameWeekday: 0, deltaYesterdayPercent: null, deltaSameWeekdayPercent: null, deltaYesterdayLabel: "new", deltaSameWeekdayLabel: "new" },
        collected: { value: 1, previousYesterday: 0, previousSameWeekday: 0, deltaYesterdayPercent: null, deltaSameWeekdayPercent: null, deltaYesterdayLabel: "new", deltaSameWeekdayLabel: "new" },
        notYetCollected: { unpaid: 0, codDue: 0, partial: 0, total: 0 },
        paymentSplit: { cash: 1, card: 0, codReceived: 0, unspecified: 0 },
        avgOrderValue: { value: 1, previousYesterday: 0, previousSameWeekday: 0, deltaYesterdayPercent: null, deltaSameWeekdayPercent: null, deltaYesterdayLabel: "new", deltaSameWeekdayLabel: "new" },
        reconciles: { booked: true, collected: true, bookedDifference: 0, collectedDifference: 0 },
      },
      cash: { shifts: [], dayTotal: { expectedCash: 0, countedCash: null, difference: null, label: "provisional" }, riderCashPending: [], riderCashPendingAllTotal: 0 },
      orders: {
        total: { value: 0, previousYesterday: 0, previousSameWeekday: 0, deltaYesterdayPercent: null, deltaSameWeekdayPercent: null, deltaYesterdayLabel: "flat", deltaSameWeekdayLabel: "flat" },
        completed: { value: 0, previousYesterday: 0, previousSameWeekday: 0, deltaYesterdayPercent: null, deltaSameWeekdayPercent: null, deltaYesterdayLabel: "flat", deltaSameWeekdayLabel: "flat" },
        cancelled: { value: 0, previousYesterday: 0, previousSameWeekday: 0, deltaYesterdayPercent: null, deltaSameWeekdayPercent: null, deltaYesterdayLabel: "flat", deltaSameWeekdayLabel: "flat" },
        late: { value: 0, previousYesterday: 0, previousSameWeekday: 0, deltaYesterdayPercent: null, deltaSameWeekdayPercent: null, deltaYesterdayLabel: "flat", deltaSameWeekdayLabel: "flat" },
        byType: { delivery: 0, takeaway: 0, dineIn: 0 },
        bySource: { online: 0, pos: 0 },
        peakHour: null,
      },
      topItems: [],
      includedInDeals: [],
      control: null,
      inventory: { lowStock: [], lowStockCount: 0 },
      feedback: null,
      menuHygiene: { duplicateLookingNames: [], note: null },
    });
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("'=evil");
  });

  it("expected cash across paid in/out and sale", () => {
    const report = buildShiftReport(
      {
        openingCash: { toString: () => "1000" },
        movements: [
          { type: CashMovementType.SALE_CASH, amount: { toString: () => "500" } },
          { type: CashMovementType.PAID_IN, amount: { toString: () => "50" } },
          { type: CashMovementType.PAID_OUT, amount: { toString: () => "25" } },
        ],
      },
      1525
    );
    expect(report.expectedCash).toBe(1525);
    expect(report.variance).toBe(0);
  });
});

