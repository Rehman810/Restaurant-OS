import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { filterDashboardForRole } from "../src/lib/dashboard/role-filter";
import type { DashboardSummary } from "../src/lib/dashboard/summary-types";
import { compareKpi } from "../src/lib/dashboard/kpi";

const base: DashboardSummary = {
  generatedAt: new Date().toISOString(),
  timezone: "Asia/Karachi",
  storeState: { onlineOrderingOpen: true, reason: "open", nextOpenLabel: null, forceClosed: false },
  kpis: {
    ordersToday: compareKpi(1, 0, 0),
    booked: compareKpi(100, 0, 0),
    collected: compareKpi(80, 0, 0),
    avgOrderValue: compareKpi(100, 0, 0),
    completedToday: compareKpi(1, 0, 0),
    cancelledToday: compareKpi(0, 0, 0),
  },
  sourceSplit: { online: 1, pos: 2, dineIn: 3 },
  paymentSplit: { cash: 1, card: 2, codReceived: 0, unspecified: 0 },
  pipeline: { stages: [], completedToday: 0 },
  lateOrders: [],
  hourlySales: {
    today: [{ hour: 0, orders: 1, revenue: 10 }],
    comparison: [],
    comparisonKind: "yesterday",
  },
  last7Days: [{ date: "2026-10-17", label: "Fri 17", orders: 1, revenue: 10 }],
  topSellers: { byQuantity: [], byRevenue: [] },
  shifts: { open: [], staleCount: 0 },
  riderCash: { pendingTotal: 0, pendingCount: 0, oldestPendingMinutes: null },
  syncConflicts: 0,
  lowStock: { count: 0, items: [] },
  dineIn: { pendingBookingConfirmations: 0, waitlistLength: 0, tablesOccupied: 0, tablesTotal: 0 },
  controls: {
    voids: { count: 0, total: 0 },
    refunds: { count: 0, total: 0 },
    discounts: { count: 0, total: 0 },
    topStaff: [],
  },
  feedback: { avgRating: null, count: 0, lowRatingCount: 0 },
  incomingOrders: [],
  thresholds: {
    lateConfirmMinutes: 15,
    latePrepMinutes: 30,
    lateDeliveryMinutes: 45,
    shiftOpenWarningHours: 12,
    riderCashWarningHours: 24,
    lowRatingThreshold: 2,
    twoFaReminderDays: 7,
  },
};

describe("dashboard role filter", () => {
  it("strips financial sections for CHEF", () => {
    const out = filterDashboardForRole(Role.CHEF, base);
    expect(out.kpis.booked).toBeNull();
    expect(out.sourceSplit).toBeNull();
    expect(out.shifts).toBeNull();
    expect(out.kpis.ordersToday.value).toBe(1);
  });

  it("keeps financials for MANAGER", () => {
    const out = filterDashboardForRole(Role.MANAGER, base);
    expect(out.kpis.booked?.value).toBe(100);
    expect(out.controls?.voids.count).toBe(0);
  });
});
