import type { MetricWithComparison } from "../metrics/compare";
import type { CompareMode, Granularity, ResolvedRange } from "./range";

export type AnalyticsOverview = {
  meta: {
    timezone: string;
    range: ResolvedRange;
    comparison: ResolvedRange | null;
    compareMode: CompareMode;
    granularity: Granularity;
    generatedAt: string;
    dataDays: number;
    enoughData: {
      insights: boolean;
      trends: boolean;
    };
  };
  kpis: {
    booked: MetricWithComparison | null;
    collected: MetricWithComparison | null;
    ordersCount: MetricWithComparison;
    completedCount: MetricWithComparison;
    cancelledCount: MetricWithComparison;
    avgOrderValue: MetricWithComparison | null;
    uniqueCustomers: MetricWithComparison;
    newCustomers: MetricWithComparison;
    returningCustomers: MetricWithComparison;
    discountsTotal: MetricWithComparison | null;
    refundsTotal: MetricWithComparison | null;
  };
  series: {
    buckets: {
      key: string;
      label: string;
      orders: number;
      booked: number | null;
      collected: number | null;
      comparisonOrders: number;
      comparisonBooked: number | null;
      comparisonCollected: number | null;
    }[];
  } | null;
  heatmap: {
    orders: number[][];
    revenue: number[][] | null;
    weekdayLabels: string[];
  } | null;
  channels: {
    sources: ChannelRow[];
    fulfillment: ChannelRow[];
  } | null;
  payments: { method: string; label: string; orders: number; amount: number; share: number }[] | null;
  statuses: { status: string; count: number; share: number }[];
  outcomes: {
    completionRate: number;
    cancellationRate: number;
    lostRevenue: number;
  };
  cancellations: {
    count: number;
    rate: number;
    lostRevenue: number;
    reasonsAvailable: boolean;
    reasons: { reason: string; count: number }[];
  };
  items: {
    rows: ItemRow[];
    total: number;
    page: number;
    pageSize: number;
    dead: { menuItemId: string; name: string }[];
    slowMovers: { menuItemId: string; name: string; quantity: number }[];
  } | null;
  categories: CategoryRow[] | null;
  attachRate: { pair: string; support: number; lift: number }[] | null;
  customers: {
    newCount: number;
    returningCount: number;
    repeatRate: number;
    avgOrdersPerCustomer: number;
    frequency: { bucket: string; count: number }[];
    topCustomers: { name: string; phone: string | null; orders: number; spend: number }[];
  } | null;
  operations: AnalyticsOperations | null;
  promotions: {
    redemptions: number;
    discountGiven: number;
    revenueFromCouponOrders: number;
    topCoupons: { code: string; uses: number; discount: number }[];
  } | null;
  control: {
    voids: { count: number; total: number };
    refunds: { count: number; total: number };
    discounts: { count: number; total: number };
    byStaff: { userId: string; name: string; voidValue: number; discountValue: number }[];
  } | null;
  profit: {
    grossProfit: number;
    collected: number;
    theoreticalCost: number;
    coveragePercent: number;
    lowCoverage: boolean;
  } | null;
  feedback: {
    avgRating: number | null;
    count: number;
    distribution: { rating: number; count: number }[];
    lowRatingCount: number;
  };
};

export type ChannelRow = {
  key: string;
  label: string;
  orders: number;
  booked: number;
  collected: number;
  share: number;
  deltaOrdersPercent: number | null;
};

export type ItemRow = {
  menuItemId: string | null;
  name: string;
  category: string;
  quantity: number;
  revenue: number;
  share: number;
  previousQuantity: number;
  deltaQuantityPercent: number | null;
  cost: number | null;
  marginPercent: number | null;
  costKnown: boolean;
};

export type CategoryRow = {
  category: string;
  revenue: number;
  share: number;
  quantity: number;
  deltaRevenuePercent: number | null;
};

export type AnalyticsOperations = {
  avgPrepMinutes: number | null;
  avgDeliveryMinutes: number | null;
  latePercent: number;
  stageDurations: { status: string; avgMinutes: number | null }[];
  riders: { riderId: string; name: string; deliveries: number; avgDeliveryMinutes: number | null }[];
  areas: { areaId: string | null; name: string; orders: number }[];
};
