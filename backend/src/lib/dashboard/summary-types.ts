import type { FulfillmentType, OrderStatus } from "@prisma/client";
import type { KpiComparison } from "./kpi";

export type DashboardSummary = {
  generatedAt: string;
  timezone: string;
  storeState: {
    onlineOrderingOpen: boolean;
    reason: "open" | "force_closed" | "schedule";
    nextOpenLabel: string | null;
    forceClosed: boolean;
  };
  kpis: {
    ordersToday: KpiComparison;
    booked: KpiComparison | null;
    collected: KpiComparison | null;
    avgOrderValue: KpiComparison | null;
    completedToday: KpiComparison;
    cancelledToday: KpiComparison;
  };
  sourceSplit: { online: number; pos: number; dineIn: number } | null;
  paymentSplit: { cash: number; card: number; codReceived: number; unspecified: number } | null;
  pipeline: {
    stages: {
      status: OrderStatus;
      label: string;
      count: number;
      oldestMinutes: number | null;
      late: boolean;
    }[];
    completedToday: number;
  };
  lateOrders: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    minutesInStatus: number;
    customerName: string;
    fulfillmentType: FulfillmentType;
  }[];
  hourlySales: {
    today: { hour: number; orders: number; revenue: number | null }[];
    comparison: { hour: number; orders: number; revenue: number | null }[];
    comparisonKind: "yesterday";
  } | null;
  last7Days: { date: string; label: string; orders: number; revenue: number | null }[] | null;
  topSellers: {
    byQuantity: TopSellerRow[];
    byRevenue: TopSellerRow[];
  };
  shifts: {
    open: { id: string; cashierName: string; openedAt: string; expectedCash: number }[];
    staleCount: number;
  } | null;
  riderCash: { pendingTotal: number; pendingCount: number; oldestPendingMinutes: number | null } | null;
  syncConflicts: number | null;
  lowStock: { count: number; items: { name: string; quantity: number; unit: string; reorderPoint: number }[] };
  dineIn: {
    pendingBookingConfirmations: number;
    waitlistLength: number;
    tablesOccupied: number;
    tablesTotal: number;
  };
  controls: {
    voids: { count: number; total: number };
    refunds: { count: number; total: number };
    discounts: { count: number; total: number };
    topStaff: { userId: string; name: string; voidValue: number; discountValue: number }[];
  } | null;
  feedback: { avgRating: number | null; count: number; lowRatingCount: number };
  incomingOrders: IncomingOrderRow[];
  riders: { id: string; name: string }[] | null;
  thresholds: {
    lateConfirmMinutes: number;
    latePrepMinutes: number;
    lateDeliveryMinutes: number;
    shiftOpenWarningHours: number;
    riderCashWarningHours: number;
    lowRatingThreshold: number;
    twoFaReminderDays: number;
  };
};

export type TopSellerRow = {
  menuItemId: string | null;
  name: string;
  quantity: number;
  revenue: number;
  foodCostPercent: number | null;
  marginPercent: number | null;
  costKnown: boolean;
};

export type IncomingOrderRow = {
  id: string;
  orderNumber: string;
  fulfillmentType: FulfillmentType;
  customerName: string;
  customerPhone: string;
  paymentMethod: string | null;
  paymentStatus: string;
  itemCount: number;
  total: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  minutesInStatus: number;
  riderId: string | null;
  isLate: boolean;
};
