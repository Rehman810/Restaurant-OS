import {
  CashShiftStatus,
  FulfillmentType,
  OrderSource,
  OrderStatus,
  ReservationStatus,
  RiderCashEntryStatus,
  Role,
  TableStatus,
  WaitlistStatus,
} from "@prisma/client";
import { prisma } from "../prisma";
import { orderAlertThresholds } from "../order-alert-thresholds";
import { getStoreSettings } from "../settings-data";
import { storeTodayUtcRange } from "../reports/time-range";
import { nextOpening } from "../hours";
import { scheduleFor, isStoreOpen } from "../store-settings";
import { lowStockForBranch } from "../inventory/stock";
import { branchQueueDate } from "../dine-in/waitlist";
import { buildShiftReport } from "../cash-shift";
import { compareKpi, roundMoney } from "./kpi";
import { aggregatePeriodOrderMetrics } from "../metrics/period-stats";
import { buildPaymentReconciliation } from "../metrics/payment-split";
import { recipeUnitCostByMenuId } from "../metrics/menu-recipe-cost";
import {
  COMPLETED_STATUSES,
  PIPELINE_STATUSES,
  sortIncomingPipelineOrders,
  isIncomingOrderLate,
} from "./order-completion";
import {
  formatChartDayLabel,
  lastNStoreDateKeys,
  shiftStoreDateKey,
  storeDateKey,
  storeHourInTz,
  utcRangeForStoreDateKey,
} from "./dates";
import type { DashboardSummary, IncomingOrderRow, TopSellerRow } from "./summary-types";
import { filterDashboardForRole } from "./role-filter";

const orderInclude = {
  items: { select: { quantity: true } },
  rider: { select: { id: true, name: true, phone: true } },
};

function minutesSince(d: Date, now: Date) {
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 60000));
}

function lateThresholdForStatus(
  status: OrderStatus,
  settings: { lateConfirmMinutes: number; latePrepMinutes: number; lateDeliveryMinutes: number }
) {
  if (status === OrderStatus.PENDING_CONFIRMATION || status === OrderStatus.CONFIRMED) {
    return settings.lateConfirmMinutes;
  }
  if (status === OrderStatus.PREPARING || status === OrderStatus.READY) {
    return settings.latePrepMinutes;
  }
  if (status === OrderStatus.OUT_FOR_DELIVERY) {
    return settings.lateDeliveryMinutes;
  }
  return null;
}

function pipelineLabel(status: OrderStatus) {
  if (status === OrderStatus.PENDING_CONFIRMATION) return "Awaiting confirmation";
  if (status === OrderStatus.CONFIRMED) return "Confirmed";
  if (status === OrderStatus.PREPARING) return "Preparing";
  if (status === OrderStatus.READY) return "Ready";
  if (status === OrderStatus.OUT_FOR_DELIVERY) return "Out for delivery";
  return status;
}

async function dayOrderStats(bw: { branchId?: string }, start: Date, end: Date) {
  const m = await aggregatePeriodOrderMetrics(bw, start, end);
  return {
    ordersToday: m.ordersCount,
    booked: m.booked,
    collected: m.collected,
    aov: m.avgOrderValue,
    completedToday: m.completedCount,
    cancelledToday: m.cancelledCount,
  };
}

async function buildTopSellers(bw: { branchId?: string }, start: Date, end: Date, branchId: string | null) {
  const lineRows = await prisma.orderItem.findMany({
    where: {
      order: {
        ...bw,
        createdAt: { gte: start, lte: end },
        status: { not: OrderStatus.CANCELLED },
      },
    },
    select: { menuItemId: true, nameAtOrder: true, quantity: true, priceAtOrder: true },
  });

  const itemMap = new Map<string, { menuItemId: string; name: string; quantity: number; revenue: number }>();
  for (const row of lineRows) {
    const key = `${row.menuItemId}:${row.nameAtOrder}`;
    const cur = itemMap.get(key) ?? {
      menuItemId: row.menuItemId,
      name: row.nameAtOrder,
      quantity: 0,
      revenue: 0,
    };
    cur.quantity += row.quantity;
    cur.revenue += row.quantity * Number(row.priceAtOrder);
    itemMap.set(key, cur);
  }
  const mapped = [...itemMap.values()];

  const byQuantity = [...mapped].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  const byRevenue = [...mapped].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const ids = [...new Set([...byQuantity, ...byRevenue].map((r) => r.menuItemId).filter(Boolean))] as string[];

  const recipeCosts = await recipeUnitCostByMenuId(branchId, ids);
  const costMap = new Map(
    [...recipeCosts.entries()].map(([id, c]) => [
      id,
      { foodCostPercent: c.foodCostPercent, marginPercent: c.marginPercent, costKnown: c.costKnown },
    ])
  );

  const enrich = (list: typeof byQuantity): TopSellerRow[] =>
    list.map((r) => {
      const c = r.menuItemId ? costMap.get(r.menuItemId) : undefined;
      return {
        menuItemId: r.menuItemId,
        name: r.name,
        quantity: r.quantity,
        revenue: roundMoney(r.revenue),
        foodCostPercent: c?.foodCostPercent ?? null,
        marginPercent: c?.marginPercent ?? null,
        costKnown: c?.costKnown ?? false,
      };
    });

  return { byQuantity: enrich(byQuantity), byRevenue: enrich(byRevenue) };
}

export async function buildDashboardSummary(
  bw: { branchId?: string },
  timezone: string,
  role: Role,
  now = new Date()
): Promise<DashboardSummary> {
  const settings = await getStoreSettings();
  const { start, end: todayEnd } = storeTodayUtcRange(timezone);
  const todayKey = storeDateKey(timezone, now);
  const yesterdayKey = shiftStoreDateKey(todayKey, -1, timezone);
  const lastWeekKey = shiftStoreDateKey(todayKey, -7, timezone);

  const yesterdayRange = utcRangeForStoreDateKey(yesterdayKey, timezone);
  const lastWeekRange = utcRangeForStoreDateKey(lastWeekKey, timezone);

  const thresholds = {
    ...orderAlertThresholds(settings),
    shiftOpenWarningHours: settings.shiftOpenWarningHours ?? 12,
    riderCashWarningHours: settings.riderCashStaleHours ?? 24,
    lowRatingThreshold: settings.lowRatingThreshold ?? 2,
    twoFaReminderDays: settings.twoFaReminderDays ?? 7,
  };

  const [today, yesterday, lastWeek] = await Promise.all([
    dayOrderStats(bw, start, todayEnd),
    dayOrderStats(bw, yesterdayRange.startUtc, yesterdayRange.endUtc),
    dayOrderStats(bw, lastWeekRange.startUtc, lastWeekRange.endUtc),
  ]);

  const schedule = scheduleFor(settings);
  const onlineOpen = isStoreOpen(settings, now);
  let reason: "open" | "force_closed" | "schedule" = "open";
  if (settings.forceClosed) reason = "force_closed";
  else if (!onlineOpen) reason = "schedule";

  let nextOpenLabel: string | null = null;
  if (!onlineOpen) {
    const next = nextOpening(schedule, timezone, now);
    nextOpenLabel = next?.label ?? null;
  }

  const branchId = bw.branchId ?? null;

  const [sourceRows, activeOrders, completedTodayPipeline, incomingRaw, syncConflictCount] =
    await Promise.all([
      prisma.order.groupBy({
        by: ["orderSource", "fulfillmentType"],
        where: { ...bw, createdAt: { gte: start, lte: todayEnd }, status: { not: OrderStatus.CANCELLED } },
        _sum: { total: true },
      }),
      prisma.order.findMany({
        where: {
          ...bw,
          status: { in: PIPELINE_STATUSES },
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          fulfillmentType: true,
          customerName: true,
          updatedAt: true,
        },
      }),
      prisma.order.count({
        where: { ...bw, createdAt: { gte: start, lte: todayEnd }, status: { in: COMPLETED_STATUSES } },
      }),
      prisma.order.findMany({
        where: { ...bw, status: { in: PIPELINE_STATUSES } },
        take: 40,
        orderBy: { updatedAt: "asc" },
        include: orderInclude,
      }),
      settings.offlinePosEnabled
        ? prisma.order.count({ where: { ...bw, needsReview: true } })
        : Promise.resolve(0),
    ]);

  const sourceSplit = { online: 0, pos: 0, dineIn: 0 };
  for (const row of sourceRows) {
    const v = Number(row._sum.total ?? 0);
    if (row.fulfillmentType === FulfillmentType.DINE_IN) sourceSplit.dineIn += v;
    else if (row.orderSource === OrderSource.POS) sourceSplit.pos += v;
    else sourceSplit.online += v;
  }

  const payRec = await buildPaymentReconciliation(bw, start, todayEnd, today.booked);
  const paymentSplit = {
    cash: payRec.split.cash,
    card: payRec.split.card,
    codReceived: payRec.split.codReceived,
    unspecified: payRec.split.unspecified,
  };

  const stageMap = new Map<OrderStatus, { count: number; oldestMinutes: number | null }>();
  for (const s of PIPELINE_STATUSES) {
    stageMap.set(s, { count: 0, oldestMinutes: null });
  }

  const lateOrders: DashboardSummary["lateOrders"] = [];

  for (const o of activeOrders) {
    if (o.status === OrderStatus.OUT_FOR_DELIVERY && o.fulfillmentType !== FulfillmentType.DELIVERY) {
      continue;
    }
    const bucket = stageMap.get(o.status);
    if (!bucket) continue;
    bucket.count += 1;
    const mins = minutesSince(o.updatedAt, now);
    if (bucket.oldestMinutes == null || mins > bucket.oldestMinutes) {
      bucket.oldestMinutes = mins;
    }
    const limit = lateThresholdForStatus(o.status, thresholds);
    if (limit != null && mins >= limit) {
      lateOrders.push({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        minutesInStatus: mins,
        customerName: o.customerName,
        fulfillmentType: o.fulfillmentType,
      });
    }
  }

  lateOrders.sort((a, b) => b.minutesInStatus - a.minutesInStatus);

  const stages = PIPELINE_STATUSES.map((status) => {
    const b = stageMap.get(status)!;
    const limit = lateThresholdForStatus(status, thresholds);
    const late = limit != null && b.oldestMinutes != null && b.oldestMinutes >= limit && b.count > 0;
    if (status === OrderStatus.OUT_FOR_DELIVERY && b.count === 0) {
      return {
        status,
        label: pipelineLabel(status),
        count: 0,
        oldestMinutes: null,
        late: false,
      };
    }
    return {
      status,
      label: pipelineLabel(status),
      count: b.count,
      oldestMinutes: b.oldestMinutes,
      late,
    };
  });

  const todayOrdersForHours = await prisma.order.findMany({
    where: { ...bw, createdAt: { gte: start, lte: todayEnd }, status: { not: OrderStatus.CANCELLED } },
    select: { createdAt: true, total: true },
  });
  const yesterdayOrdersForHours = await prisma.order.findMany({
    where: {
      ...bw,
      createdAt: { gte: yesterdayRange.startUtc, lte: yesterdayRange.endUtc },
      status: { not: OrderStatus.CANCELLED },
    },
    select: { createdAt: true, total: true },
  });

  const bucketHours = (orders: { createdAt: Date; total: unknown }[]) => {
    const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, revenue: 0 }));
    for (const o of orders) {
      const h = storeHourInTz(timezone, o.createdAt);
      buckets[h].orders += 1;
      buckets[h].revenue += Number(o.total);
    }
    return buckets.map((b) => ({ ...b, revenue: roundMoney(b.revenue) }));
  };

  const dateKeys = lastNStoreDateKeys(timezone, 7, now);
  const last7Days = await Promise.all(
    dateKeys.map(async (dateKey) => {
      const { startUtc, endUtc } = utcRangeForStoreDateKey(dateKey, timezone);
      const [count, sum] = await Promise.all([
        prisma.order.count({
          where: { ...bw, createdAt: { gte: startUtc, lte: endUtc }, status: { not: OrderStatus.CANCELLED } },
        }),
        prisma.order.aggregate({
          where: { ...bw, createdAt: { gte: startUtc, lte: endUtc }, status: { not: OrderStatus.CANCELLED } },
          _sum: { total: true },
        }),
      ]);
      return {
        date: dateKey,
        label: formatChartDayLabel(dateKey, timezone),
        orders: count,
        revenue: roundMoney(Number(sum._sum.total ?? 0)),
      };
    })
  );

  const topSellers = await buildTopSellers(bw, start, todayEnd, branchId);

  const shiftWarningMs = thresholds.shiftOpenWarningHours * 60 * 60 * 1000;
  const openShifts = await prisma.cashShift.findMany({
    where: { ...(branchId ? { branchId } : {}), status: CashShiftStatus.OPEN },
    include: {
      cashier: { select: { name: true } },
      movements: true,
    },
    take: 20,
  });
  const staleShifts = openShifts.filter((s) => now.getTime() - s.openedAt.getTime() > shiftWarningMs);

  const riderStaleBefore = new Date(now.getTime() - thresholds.riderCashWarningHours * 60 * 60 * 1000);
  const pendingRider = await prisma.riderCashEntry.findMany({
    where: { ...bw, status: RiderCashEntryStatus.PENDING },
    select: { collectedAmount: true, deliveredAt: true },
  });
  const riderPendingTotal = pendingRider.reduce((s, e) => s + Number(e.collectedAmount), 0);
  const oldestRider = pendingRider.reduce<Date | null>((acc, e) => {
    if (!acc || e.deliveredAt < acc) return e.deliveredAt;
    return acc;
  }, null);

  const lowStockList = branchId ? await lowStockForBranch(branchId) : [];
  const lowStockItems = [...lowStockList].sort((a, b) => a.quantity - b.quantity).slice(0, 5);

  const dineInWhere = branchId ? { branchId } : {};
  const [pendingReservations, waitlistCount, tablesOccupied, tablesTotal] = await Promise.all([
    prisma.reservation.count({
      where: { ...dineInWhere, status: ReservationStatus.PENDING, startsAt: { gte: start } },
    }),
    prisma.waitlistEntry.count({
      where: {
        ...dineInWhere,
        queueDate: branchQueueDate(timezone, now),
        status: WaitlistStatus.WAITING,
      },
    }),
    prisma.diningTable.count({
      where: { ...dineInWhere, status: { in: [TableStatus.OCCUPIED, TableStatus.RESERVED] } },
    }),
    prisma.diningTable.count({ where: dineInWhere }),
  ]);

  const feedbackRows = await prisma.orderFeedback.findMany({
    where: {
      createdAt: { gte: start, lte: todayEnd },
      order: bw.branchId ? { branchId: bw.branchId } : {},
    },
    select: { rating: true },
  });
  const feedbackCount = feedbackRows.length;
  const feedbackAvg =
    feedbackCount > 0
      ? Math.round((feedbackRows.reduce((s, r) => s + r.rating, 0) / feedbackCount) * 10) / 10
      : null;
  const lowRatingCount = feedbackRows.filter((r) => r.rating <= thresholds.lowRatingThreshold).length;

  const controlWhere = {
    ...bw,
    createdAt: { gte: start, lte: todayEnd },
  };
  const [voidOrders, refundAgg, discountAgg] = await Promise.all([
    prisma.order.findMany({
      where: { ...controlWhere, voidReasonCode: { not: null } },
      select: { total: true, voidApprovedById: true, createdById: true },
    }),
    prisma.order.aggregate({
      where: { ...controlWhere, refundAmount: { not: null } },
      _sum: { refundAmount: true },
      _count: { id: true },
    }),
    prisma.order.aggregate({
      where: { ...controlWhere, discountAmount: { gt: 0 } },
      _sum: { discountAmount: true },
      _count: { id: true },
    }),
  ]);

  const staffMap = new Map<string, { voidValue: number; discountValue: number }>();
  for (const v of voidOrders) {
    const uid = v.voidApprovedById ?? v.createdById;
    if (!uid) continue;
    const cur = staffMap.get(uid) ?? { voidValue: 0, discountValue: 0 };
    cur.voidValue += Number(v.total);
    staffMap.set(uid, cur);
  }

  const discountOrders = await prisma.order.findMany({
    where: { ...controlWhere, discountAmount: { gt: 0 } },
    select: { discountAmount: true, adjustmentApprovedById: true, createdById: true },
  });
  for (const d of discountOrders) {
    const uid = d.adjustmentApprovedById ?? d.createdById;
    if (!uid) continue;
    const cur = staffMap.get(uid) ?? { voidValue: 0, discountValue: 0 };
    cur.discountValue += Number(d.discountAmount);
    staffMap.set(uid, cur);
  }

  const staffIds = [...staffMap.keys()];
  const staffUsers = staffIds.length
    ? await prisma.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } })
    : [];
  const staffName = new Map(staffUsers.map((u) => [u.id, u.name]));

  const topStaff = [...staffMap.entries()]
    .map(([userId, v]) => ({
      userId,
      name: staffName.get(userId) ?? "Staff",
      voidValue: roundMoney(v.voidValue),
      discountValue: roundMoney(v.discountValue),
    }))
    .sort((a, b) => b.voidValue + b.discountValue - (a.voidValue + a.discountValue))
    .slice(0, 5);

  const riderRows =
    role === Role.ADMIN || role === Role.MANAGER || role === Role.CASHIER
      ? await prisma.user.findMany({
          where: { role: Role.RIDER, isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
          take: 50,
        })
      : [];

  const incomingMapped: IncomingOrderRow[] = incomingRaw.map((o) => {
    const minutesInStatus = minutesSince(o.updatedAt, now);
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      fulfillmentType: o.fulfillmentType,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
      total: Number(o.total),
      status: o.status,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
      minutesInStatus,
      riderId: o.riderId ?? null,
      isLate: isIncomingOrderLate(o.status, minutesInStatus, thresholds),
    };
  });
  const incomingOrders = sortIncomingPipelineOrders(incomingMapped, thresholds).slice(0, 20);

  const summary: DashboardSummary = {
    generatedAt: now.toISOString(),
    timezone,
    storeState: {
      onlineOrderingOpen: onlineOpen,
      reason,
      nextOpenLabel,
      forceClosed: settings.forceClosed,
    },
    kpis: {
      ordersToday: compareKpi(today.ordersToday, yesterday.ordersToday, lastWeek.ordersToday),
      booked: compareKpi(roundMoney(today.booked), roundMoney(yesterday.booked), roundMoney(lastWeek.booked)),
      collected: compareKpi(
        roundMoney(today.collected),
        roundMoney(yesterday.collected),
        roundMoney(lastWeek.collected)
      ),
      avgOrderValue: compareKpi(today.aov, yesterday.aov, lastWeek.aov),
      completedToday: compareKpi(today.completedToday, yesterday.completedToday, lastWeek.completedToday),
      cancelledToday: compareKpi(today.cancelledToday, yesterday.cancelledToday, lastWeek.cancelledToday),
    },
    sourceSplit,
    paymentSplit,
    pipeline: { stages, completedToday: completedTodayPipeline },
    lateOrders,
    hourlySales: {
      today: bucketHours(todayOrdersForHours),
      comparison: bucketHours(yesterdayOrdersForHours),
      comparisonKind: "yesterday",
    },
    last7Days,
    topSellers,
    shifts: {
      open: openShifts.map((s) => {
        const report = buildShiftReport(s);
        return {
          id: s.id,
          cashierName: s.cashier.name,
          openedAt: s.openedAt.toISOString(),
          expectedCash: roundMoney(report.expectedCash),
        };
      }),
      staleCount: staleShifts.length,
    },
    riderCash: {
      pendingTotal: roundMoney(riderPendingTotal),
      pendingCount: pendingRider.length,
      oldestPendingMinutes: oldestRider ? minutesSince(oldestRider, now) : null,
    },
    syncConflicts: settings.offlinePosEnabled ? syncConflictCount : null,
    lowStock: {
      count: lowStockList.length,
      items: lowStockItems.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        reorderPoint: i.reorderPoint,
      })),
    },
    dineIn: {
      pendingBookingConfirmations: pendingReservations,
      waitlistLength: waitlistCount,
      tablesOccupied,
      tablesTotal,
    },
    controls: {
      voids: { count: voidOrders.length, total: roundMoney(voidOrders.reduce((s, o) => s + Number(o.total), 0)) },
      refunds: {
        count: refundAgg._count.id,
        total: roundMoney(Number(refundAgg._sum.refundAmount ?? 0)),
      },
      discounts: {
        count: discountAgg._count.id,
        total: roundMoney(Number(discountAgg._sum.discountAmount ?? 0)),
      },
      topStaff,
    },
    feedback: { avgRating: feedbackAvg, count: feedbackCount, lowRatingCount },
    incomingOrders,
    riders: riderRows.length ? riderRows : null,
    thresholds,
  };

  return filterDashboardForRole(role, summary);
}

export async function resolveDashboardTimezone(scope: { allBranches: boolean; branchId?: string | null }) {
  const settings = await getStoreSettings();
  if (!scope.allBranches && scope.branchId) {
    const branch = await prisma.branch.findUnique({
      where: { id: scope.branchId },
      select: { timezone: true },
    });
    return branch?.timezone || settings.timezone || "Asia/Karachi";
  }
  return settings.timezone || "Asia/Karachi";
}
