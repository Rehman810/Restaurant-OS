import type { KpiComparison } from "@/lib/dashboard/types";

export type DailySummaryPayload = {
  meta: {
    date: string;
    timezone: string;
    generatedAt: string;
    status: "provisional" | "final";
    finalReasons: string[];
    branch: { id: string; name: string };
    definitions: Record<string, string>;
    statusHelp?: string;
    compare?: string;
  };
  needsAttention: {
    type: string;
    severity: "info" | "warning" | "critical";
    message: string;
    count: number;
    link: string;
    details?: unknown[];
  }[];
  money: {
    booked: KpiComparison;
    collected: KpiComparison;
    notYetCollected: { unpaid: number; codDue: number; partial: number; total: number };
    paymentSplit: { cash: number; card: number; codReceived: number; unspecified: number };
    avgOrderValue: KpiComparison;
    reconciles: {
      booked: boolean;
      collected: boolean;
      bookedDifference: number;
      collectedDifference: number;
    };
  };
  cash: {
    shifts: {
      id: string;
      cashierName: string;
      openedAt: string;
      closedAt: string | null;
      float: number;
      cashSales: number;
      paidIn: number;
      paidOut: number;
      expectedCash: number;
      countedCash: number | null;
      difference: number | null;
      status: string;
    }[];
    dayTotal: {
      expectedCash: number;
      countedCash: number | null;
      difference: number | null;
      label: "provisional" | "final";
    };
    riderCashPending: { riderName: string; orderNumber: string; amount: number; deliveredAt: string }[];
  };
  orders: {
    total: KpiComparison;
    completed: KpiComparison;
    cancelled: KpiComparison;
    late: KpiComparison;
    byType: { delivery: number; takeaway: number; dineIn: number };
    bySource: { online: number; pos: number };
    peakHour: { hour: number; orders: number } | null;
  };
  topItems: {
    kind: "dish" | "deal";
    id: string;
    name: string;
    quantity: number;
    revenue: number;
    share: number;
    marginPercent: number | null;
    components?: { name: string; quantity: number }[];
  }[];
  includedInDeals: { menuItemId: string; name: string; quantity: number }[];
  control: {
    discounts: { tracked: boolean; count: number; total: number; byReason: { reason: string; count: number; total: number }[] };
    voids: { tracked: boolean; count: number };
    refunds: { tracked: boolean; total: number };
    waste: { tracked: boolean; count: number; total: number };
  } | null;
  inventory: {
    lowStock: { itemId: string; name: string; stock: number; reorderLevel: number; unit: string }[];
    lowStockCount: number;
  };
  menuHygiene: { duplicateLookingNames: { id: string; name: string }[]; note: string | null };
};
