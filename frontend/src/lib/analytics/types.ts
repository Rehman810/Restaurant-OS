export type MetricWithComparison = {
  value: number;
  previous: number;
  deltaPercent: number | null;
  deltaLabel: "new" | "flat" | null;
};

export type AnalyticsOverview = {
  meta: {
    timezone: string;
    range: { fromKey: string; toKey: string; preset: string };
    comparison: { fromKey: string; toKey: string } | null;
    compareMode: string;
    granularity: string;
    generatedAt: string;
    dataDays: number;
    enoughData: { insights: boolean; trends: boolean };
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
  heatmap: { orders: number[][]; revenue: number[][] | null; weekdayLabels: string[] } | null;
  channels: {
    sources: { key: string; label: string; orders: number; booked: number; collected: number; share: number }[];
    fulfillment: { key: string; label: string; orders: number; booked: number; collected: number; share: number }[];
  } | null;
  payments: { method: string; label: string; orders: number; amount: number; share: number }[] | null;
  statuses: { status: string; count: number; share: number }[];
  outcomes: { completionRate: number; cancellationRate: number; lostRevenue: number };
  cancellations: {
    count: number;
    rate: number;
    lostRevenue: number;
    reasonsAvailable: boolean;
    reasons: { reason: string; count: number }[];
  };
  items: {
    rows: {
      menuItemId: string | null;
      name: string;
      category: string;
      quantity: number;
      revenue: number;
      share: number;
      marginPercent: number | null;
      costKnown: boolean;
    }[];
    total: number;
    page: number;
    pageSize: number;
    dead: { menuItemId: string; name: string }[];
    slowMovers: { menuItemId: string; name: string; quantity: number }[];
  } | null;
  categories: {
    category: string;
    revenue: number;
    share: number;
    quantity: number;
    deltaRevenuePercent: number | null;
  }[] | null;
  customers: {
    newCount: number;
    returningCount: number;
    repeatRate: number;
    avgOrdersPerCustomer: number;
    frequency: { bucket: string; count: number }[];
    topCustomers: { name: string; phone: string | null; orders: number; spend: number }[];
  } | null;
  operations: {
    avgPrepMinutes: number | null;
    avgDeliveryMinutes: number | null;
    latePercent: number;
    riders: { riderId: string; name: string; deliveries: number; avgDeliveryMinutes: number | null }[];
    areas: { areaId: string | null; name: string; orders: number }[];
  } | null;
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
    lowRatingCount: number;
    distribution?: { rating: number; count: number }[];
  };
};

export type AnalyticsPreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "last_30"
  | "this_year"
  | "custom";

export type CompareMode = "previous" | "lastYear" | "none";
