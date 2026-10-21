import { describe, expect, it } from "vitest";
import { formatDailyCloseoutEmailText } from "../src/lib/reports/daily-closeout-email";
import type { DailyCloseOutPayload } from "../src/lib/reports/daily-close-out";
import { METRIC_DEFINITIONS } from "../src/lib/metrics/definitions";

const kpi = {
  value: 100,
  previousYesterday: 90,
  previousSameWeekday: 80,
  deltaYesterdayPercent: 11.1,
  deltaSameWeekdayPercent: 25,
  deltaYesterdayLabel: null,
  deltaSameWeekdayLabel: null,
};

function minimalPayload(overrides?: Partial<DailyCloseOutPayload>): DailyCloseOutPayload {
  return {
    meta: {
      date: "2026-10-21",
      timezone: "Asia/Karachi",
      storeDayStart: "",
      storeDayEnd: "",
      generatedAt: "",
      status: "provisional",
      finalReasons: ["1 shift open"],
      branch: { id: "b1", name: "Main" },
      definitions: METRIC_DEFINITIONS,
      statusHelp: "test",
    },
    needsAttention: [{ type: "unclosed_shifts", severity: "critical", message: "1 open", count: 1, link: "/admin/shifts" }],
    money: {
      booked: kpi,
      collected: kpi,
      notYetCollected: { unpaid: 0, codDue: 50, partial: 0, total: 50 },
      paymentSplit: { cash: 40, card: 10, codReceived: 50, unspecified: 0 },
      avgOrderValue: kpi,
      reconciles: { booked: true, collected: true, bookedDifference: 0, collectedDifference: 0 },
    },
    cash: {
      shifts: [],
      dayTotal: { expectedCash: 0, countedCash: null, difference: null, label: "provisional" },
      riderCashPending: [],
      riderCashPendingAllTotal: 0,
    },
    orders: {
      total: kpi,
      completed: kpi,
      cancelled: { ...kpi, value: 0 },
      late: { ...kpi, value: 2 },
      byType: { delivery: 1, takeaway: 2, dineIn: 0 },
      bySource: { online: 2, pos: 1 },
      peakHour: { hour: 20, orders: 3 },
    },
    topItems: [{ kind: "dish", id: "1", name: "Biryani", quantity: 5, revenue: 100, share: 50, marginPercent: null }],
    includedInDeals: [],
    control: null,
    inventory: { lowStock: [], lowStockCount: 0 },
    feedback: null,
    menuHygiene: { duplicateLookingNames: [], note: null },
    ...overrides,
  };
}

describe("daily close-out email", () => {
  it("snapshot key lines", () => {
    const text = formatDailyCloseoutEmailText(minimalPayload(), "https://admin/daily-summary");
    expect(text).toContain("Daily close-out — 2026-10-21");
    expect(text).toContain("Status: provisional");
    expect(text).toContain("Collected: 100");
    expect(text).toContain("Not yet collected: 50");
    expect(text).toContain("Needs attention");
  });
});
