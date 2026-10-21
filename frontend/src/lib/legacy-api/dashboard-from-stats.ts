import { api } from "@/lib/api";
import type { DashboardSummary } from "@/lib/dashboard/types";
import type { IncomingOrderRow, KpiComparison } from "@/lib/dashboard/types";
import type { Order, OrderStatus } from "@/lib/types";

function kpi(value: number): KpiComparison {
  return {
    value,
    previousYesterday: 0,
    previousSameWeekday: 0,
    deltaYesterdayPercent: null,
    deltaSameWeekdayPercent: null,
    deltaYesterdayLabel: value === 0 ? "flat" : "new",
    deltaSameWeekdayLabel: value === 0 ? "flat" : "new",
  };
}

type LegacyAdminStats = {
  todayOrders: number;
  todayRevenue: number;
  deliveredToday: number;
  cancelledToday: number;
  avgOrderValue: number;
  awaitingConfirmation: number;
  pending: number;
  preparing: number;
  outForDelivery: number;
  statusBreakdown: Record<string, number>;
  chart: { date: string; label: string; orders: number; revenue: number }[];
  topItems: { name: string; qty: number; revenue: number }[];
  recentOrders: Order[];
  riderCashPendingTotal: number;
  riderCashPendingCount: number;
  posTodayOrders: number;
};

const STAGE_LABELS: Record<OrderStatus, string> = {
  PENDING_CONFIRMATION: "Awaiting",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  READY: "Ready",
  OUT_FOR_DELIVERY: "Out",
  DELIVERED: "Delivered",
  COLLECTED: "Collected",
  SERVED: "Served",
  CANCELLED: "Cancelled",
};

export async function fetchDashboardSummaryFromLegacyStats(
  branchQuery?: string
): Promise<DashboardSummary> {
  const qs = branchQuery ? `?branchId=${encodeURIComponent(branchQuery)}` : "";
  const stats = await api<LegacyAdminStats>(`/admin/stats${qs}`);
  const store = await api<{ isOpen: boolean; settings: { forceClosed?: boolean; timezone?: string } }>(
    "/settings/public"
  );
  const timezone = store.settings.timezone || "Asia/Karachi";
  const now = new Date().toISOString();

  const stages: OrderStatus[] = [
    "PENDING_CONFIRMATION",
    "CONFIRMED",
    "PREPARING",
    "READY",
    "OUT_FOR_DELIVERY",
  ];

  return {
    generatedAt: now,
    timezone,
    storeState: {
      onlineOrderingOpen: store.isOpen,
      reason: store.settings.forceClosed ? "force_closed" : store.isOpen ? "open" : "schedule",
      nextOpenLabel: null,
      forceClosed: Boolean(store.settings.forceClosed),
    },
    kpis: {
      ordersToday: kpi(stats.todayOrders),
      booked: kpi(stats.todayRevenue),
      collected: kpi(stats.todayRevenue),
      avgOrderValue: kpi(stats.avgOrderValue),
      completedToday: kpi(stats.deliveredToday),
      cancelledToday: kpi(stats.cancelledToday),
    },
    sourceSplit: {
      online: Math.max(0, stats.todayOrders - stats.posTodayOrders),
      pos: stats.posTodayOrders,
      dineIn: 0,
    },
    paymentSplit: null,
    pipeline: {
      stages: stages.map((status) => ({
        status,
        label: STAGE_LABELS[status],
        count: stats.statusBreakdown[status] ?? 0,
        oldestMinutes: null,
        late: false,
      })),
      completedToday: stats.deliveredToday,
    },
    lateOrders: [],
    hourlySales: null,
    last7Days: stats.chart.map((d) => ({
      date: d.date,
      label: d.label,
      orders: d.orders,
      revenue: d.revenue,
    })),
    topSellers: {
      byQuantity: stats.topItems.map((t) => ({
        menuItemId: null,
        name: t.name,
        quantity: t.qty,
        revenue: t.revenue,
        foodCostPercent: null,
        marginPercent: null,
        costKnown: false,
      })),
      byRevenue: stats.topItems.map((t) => ({
        menuItemId: null,
        name: t.name,
        quantity: t.qty,
        revenue: t.revenue,
        foodCostPercent: null,
        marginPercent: null,
        costKnown: false,
      })),
    },
    shifts: null,
    riderCash: {
      pendingTotal: stats.riderCashPendingTotal,
      pendingCount: stats.riderCashPendingCount,
      oldestPendingMinutes: null,
    },
    syncConflicts: null,
    lowStock: { count: 0, items: [] },
    dineIn: {
      pendingBookingConfirmations: 0,
      waitlistLength: 0,
      tablesOccupied: 0,
      tablesTotal: 0,
    },
    controls: null,
    feedback: { avgRating: null, count: 0, lowRatingCount: 0 },
    incomingOrders: stats.recentOrders.slice(0, 8).map((o): IncomingOrderRow => {
      const createdAt = o.createdAt || new Date().toISOString();
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        fulfillmentType: o.fulfillmentType || "DELIVERY",
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        paymentMethod: o.paymentMethod || null,
        paymentStatus: o.paymentStatus || "UNPAID",
        itemCount: o.items?.reduce((s, it) => s + it.quantity, 0) || 0,
        total: Number(o.total),
        createdAt,
        updatedAt: createdAt,
        isLate: false,
        minutesInStatus: 0,
        riderId: o.riderId || null,
      };
    }),
    thresholds: {
      lateConfirmMinutes: 15,
      latePrepMinutes: 30,
      lateDeliveryMinutes: 45,
      shiftOpenWarningHours: 12,
      riderCashWarningHours: 24,
      lowRatingThreshold: 2,
      twoFaReminderDays: 7,
    },
    riders: null,
  };
}
