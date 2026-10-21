import {
  CashMovementType,
  CashShiftStatus,
  FulfillmentType,
  OrderSource,
  OrderStatus,
  RiderCashEntryStatus,
  Role,
} from "@prisma/client";
import { prisma } from "../prisma";
import { aggregatePeriodOrderMetrics } from "../metrics/period-stats";
import { METRIC_DEFINITIONS } from "../metrics/definitions";
import { buildPaymentReconciliation } from "../metrics/payment-split";
import { compareKpi, roundMoney } from "../dashboard/kpi";
import { shiftStoreDateKey, utcRangeForStoreDateKey } from "../dashboard/dates";
import { lowStockForBranch } from "../inventory/stock";
import { buildShiftReport } from "../cash-shift";
import { orderAlertThresholds } from "../order-alert-thresholds";
import { getStoreSettings } from "../settings-data";
import { isIncomingOrderLate } from "../dashboard/order-completion";
import { recipeUnitCostByMenuId } from "../metrics/menu-recipe-cost";
import { cacheKey, getCached, setCached } from "../analytics/cache";
import type { KpiComparison } from "../dashboard/kpi";

const DEAL_SEP = " · ";

export type DailySummaryCompare = "yesterday" | "lastWeek" | "none";

export type DailyCloseOutParams = {
  branchId: string;
  branchName: string;
  dateKey: string;
  timezone: string;
  role: Role;
  compare?: DailySummaryCompare;
};

export type DailyCloseOutPayload = {
  meta: {
    date: string;
    timezone: string;
    storeDayStart: string;
    storeDayEnd: string;
    generatedAt: string;
    status: "provisional" | "final";
    finalReasons: string[];
    branch: { id: string; name: string };
    definitions: typeof METRIC_DEFINITIONS;
    /** Plain-language rules shown in UI (final vs provisional). */
    statusHelp: string;
  };
  needsAttention: NeedsAttentionItem[];
  money: {
    booked: KpiComparison;
    collected: KpiComparison;
    notYetCollected: import("../metrics/payment-split").NotYetCollected;
    paymentSplit: {
      cash: number;
      card: number;
      codReceived: number;
      unspecified: number;
    };
    avgOrderValue: KpiComparison;
    reconciles: {
      booked: boolean;
      collected: boolean;
      bookedDifference: number;
      collectedDifference: number;
    };
  };
  cash: {
    shifts: unknown[];
    dayTotal: {
      expectedCash: number;
      countedCash: number | null;
      difference: number | null;
      label: "provisional" | "final";
    };
    riderCashPending: unknown[];
    riderCashPendingAllTotal: number;
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
  topItems: unknown[];
  includedInDeals: unknown[];
  control: unknown | null;
  inventory: {
    lowStock: { itemId: string; name: string; stock: number; reorderLevel: number; unit: string }[];
    lowStockCount: number;
  };
  feedback: unknown | null;
  menuHygiene: { duplicateLookingNames: { id: string; name: string }[]; note: string | null };
};

export type NeedsAttentionItem = {
  type: string;
  severity: "info" | "warning" | "critical";
  message: string;
  count: number;
  link: string;
  details?: unknown[];
};

function moneyMetric(value: number, prevYesterday: number, prevWeek: number): KpiComparison {
  return compareKpi(roundMoney(value), roundMoney(prevYesterday), roundMoney(prevWeek));
}

function intMetric(value: number, prevYesterday: number, prevWeek: number): KpiComparison {
  return compareKpi(value, prevYesterday, prevWeek);
}

function parseDealLine(nameAtOrder: string): { dealTitle: string; componentName: string } | null {
  const idx = nameAtOrder.indexOf(DEAL_SEP);
  if (idx < 0) return null;
  return {
    dealTitle: nameAtOrder.slice(0, idx),
    componentName: nameAtOrder.slice(idx + DEAL_SEP.length),
  };
}

async function buildTopItems(
  branchId: string,
  startUtc: Date,
  endUtc: Date,
  includeMargin: boolean
) {
  const bookedWhere = {
    branchId,
    createdAt: { gte: startUtc, lte: endUtc },
    status: { not: OrderStatus.CANCELLED },
  };

  const lines = await prisma.orderItem.findMany({
    where: { order: bookedWhere },
    select: {
      orderId: true,
      menuItemId: true,
      nameAtOrder: true,
      quantity: true,
      priceAtOrder: true,
    },
  });

  const deals = await prisma.deal.findMany({
    where: { isActive: true },
    include: { items: { select: { menuItemId: true, quantity: true, menuItem: { select: { name: true } } } } },
  });
  const dealByTitle = new Map(deals.map((d) => [d.title, d]));

  type DishRow = {
    kind: "dish";
    id: string;
    name: string;
    quantity: number;
    revenue: number;
    share: number;
    marginPercent: number | null;
    costKnown: boolean;
  };
  type DealRow = {
    kind: "deal";
    id: string;
    name: string;
    quantity: number;
    revenue: number;
    share: number;
    marginPercent: number | null;
    costKnown: boolean;
    components: { name: string; quantity: number }[];
  };

  const dishMap = new Map<string, DishRow>();
  const dealMap = new Map<string, DealRow>();
  const includedInDeals = new Map<string, { menuItemId: string; name: string; quantity: number }>();

  const byOrderDeal = new Map<string, Map<string, { menuItemId: string; qty: number; revenue: number; name: string }[]>>();

  for (const line of lines) {
    const parsed = parseDealLine(line.nameAtOrder);
    if (parsed) {
      const orderKey = line.orderId;
      const dealKey = parsed.dealTitle;
      const perOrder = byOrderDeal.get(orderKey) ?? new Map();
      const arr = perOrder.get(dealKey) ?? [];
      arr.push({
        menuItemId: line.menuItemId,
        qty: line.quantity,
        revenue: Number(line.priceAtOrder) * line.quantity,
        name: parsed.componentName,
      });
      perOrder.set(dealKey, arr);
      byOrderDeal.set(orderKey, perOrder);

      const inc = includedInDeals.get(line.menuItemId) ?? {
        menuItemId: line.menuItemId,
        name: parsed.componentName,
        quantity: 0,
      };
      inc.quantity += line.quantity;
      includedInDeals.set(line.menuItemId, inc);
      continue;
    }

    const rev = Number(line.priceAtOrder) * line.quantity;
    const cur = dishMap.get(line.menuItemId) ?? {
      kind: "dish" as const,
      id: line.menuItemId,
      name: line.nameAtOrder,
      quantity: 0,
      revenue: 0,
      share: 0,
      marginPercent: null,
      costKnown: false,
    };
    cur.quantity += line.quantity;
    cur.revenue += rev;
    dishMap.set(line.menuItemId, cur);
  }

  for (const [, perOrder] of byOrderDeal) {
    for (const [dealTitle, components] of perOrder) {
      const dealDef = dealByTitle.get(dealTitle);
      let dealUnits = 1;
      if (dealDef) {
        const unitCandidates = components.map((c) => {
          const di = dealDef.items.find((i) => i.menuItemId === c.menuItemId);
          const perDeal = di?.quantity ?? 1;
          return Math.floor(c.qty / perDeal) || 0;
        });
        dealUnits = unitCandidates.length ? Math.min(...unitCandidates) : 1;
        if (dealUnits <= 0) dealUnits = 1;
      }
      const revenue = roundMoney(components.reduce((s, c) => s + c.revenue, 0));
      const compSummary = components.map((c) => ({ name: c.name, quantity: c.qty }));
      const id = dealDef?.id ?? `title:${dealTitle}`;
      const cur = dealMap.get(id) ?? {
        kind: "deal" as const,
        id,
        name: dealTitle,
        quantity: 0,
        revenue: 0,
        share: 0,
        marginPercent: null,
        costKnown: false,
        components: [],
      };
      cur.quantity += dealUnits;
      cur.revenue = roundMoney(cur.revenue + revenue);
      for (const c of compSummary) {
        const existing = cur.components.find((x) => x.name === c.name);
        if (existing) existing.quantity += c.quantity;
        else cur.components.push({ ...c });
      }
      dealMap.set(id, cur);
    }
  }

  const allRows = [...dishMap.values(), ...dealMap.values()];
  const totalRev = allRows.reduce((s, r) => s + r.revenue, 0) || 1;
  for (const r of allRows) {
    r.revenue = roundMoney(r.revenue);
    r.share = Math.round((r.revenue / totalRev) * 1000) / 10;
  }

  if (includeMargin) {
    const menuIds = [...dishMap.keys(), ...includedInDeals.keys()];
    const costs = await recipeUnitCostByMenuId(branchId, menuIds);
    for (const r of dishMap.values()) {
      const c = costs.get(r.id);
      if (c?.costKnown && c.unitCost != null && r.revenue > 0) {
        r.costKnown = true;
        r.marginPercent = Math.round(((r.revenue - c.unitCost * r.quantity) / r.revenue) * 1000) / 10;
      }
    }
    for (const r of dealMap.values()) {
      r.costKnown = false;
      r.marginPercent = null;
    }
  }

  const topItems = [...allRows]
    .sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity)
    .slice(0, 15);

  return {
    topItems,
    includedInDeals: [...includedInDeals.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 20),
  };
}

function shiftCashBreakdown(byType: Record<string, number>) {
  const cashSales = byType[CashMovementType.SALE_CASH] ?? 0;
  const paidIn = byType[CashMovementType.PAID_IN] ?? 0;
  const paidOut = byType[CashMovementType.PAID_OUT] ?? 0;
  const refundCash = byType[CashMovementType.REFUND_CASH] ?? 0;
  return {
    cashSales: roundMoney(cashSales),
    paidIn: roundMoney(paidIn),
    paidOut: roundMoney(paidOut + refundCash),
    changeGiven: 0,
  };
}

export async function buildDailyCloseOut(params: DailyCloseOutParams): Promise<DailyCloseOutPayload> {
  const { branchId, branchName, dateKey, timezone, role } = params;
  const includeControl = role === Role.ADMIN || role === Role.MANAGER;
  const includeMargin = includeControl;

  const { startUtc, endUtc } = utcRangeForStoreDateKey(dateKey, timezone);
  const yesterdayKey = shiftStoreDateKey(dateKey, -1, timezone);
  const lastWeekKey = shiftStoreDateKey(dateKey, -7, timezone);
  const yesterdayRange = utcRangeForStoreDateKey(yesterdayKey, timezone);
  const lastWeekRange = utcRangeForStoreDateKey(lastWeekKey, timezone);

  const todayEnd = endUtc;
  const isPastFinalCandidate = todayEnd.getTime() < Date.now() - 60_000;

  const cacheK = cacheKey({
    dailyCloseOut: true,
    branchId,
    dateKey,
    role: includeControl ? "mgr" : "other",
  });
  if (isPastFinalCandidate) {
    const cached = getCached<DailyCloseOutPayload>(cacheK);
    if (cached?.meta?.status === "final") return cached;
  }

  const settings = await getStoreSettings();
  const thresholds = orderAlertThresholds(settings);

  const [metrics, prevDay, prevWeek, lowStock, shifts, riderPendingDay, riderPendingAll] =
    await Promise.all([
      aggregatePeriodOrderMetrics({ branchId }, startUtc, endUtc),
      aggregatePeriodOrderMetrics({ branchId }, yesterdayRange.startUtc, yesterdayRange.endUtc),
      aggregatePeriodOrderMetrics({ branchId }, lastWeekRange.startUtc, lastWeekRange.endUtc),
      lowStockForBranch(branchId),
      prisma.cashShift.findMany({
        where: {
          branchId,
          openedAt: { lte: endUtc },
          OR: [{ closedAt: null }, { closedAt: { gte: startUtc } }],
        },
        include: {
          cashier: { select: { id: true, name: true } },
          movements: true,
        },
        orderBy: { openedAt: "asc" },
      }),
      prisma.riderCashEntry.findMany({
        where: {
          branchId,
          status: RiderCashEntryStatus.PENDING,
          deliveredAt: { gte: startUtc, lte: endUtc },
        },
        include: {
          rider: { select: { id: true, name: true } },
          order: { select: { id: true, orderNumber: true } },
        },
        orderBy: { deliveredAt: "asc" },
      }),
      prisma.riderCashEntry.findMany({
        where: { branchId, status: RiderCashEntryStatus.PENDING },
        select: { id: true, collectedAmount: true },
      }),
    ]);

  const payment = await buildPaymentReconciliation({ branchId }, startUtc, endUtc, metrics.booked);

  const orderRows = await prisma.order.findMany({
    where: {
      branchId,
      createdAt: { gte: startUtc, lte: endUtc },
    },
    select: {
      id: true,
      status: true,
      fulfillmentType: true,
      orderSource: true,
      updatedAt: true,
      createdAt: true,
    },
  });

  let late = 0;
  const byType = { delivery: 0, takeaway: 0, dineIn: 0 };
  const bySource = { online: 0, pos: 0 };
  const hourCounts = new Map<number, number>();
  const now = new Date();

  for (const o of orderRows) {
    if (o.status === OrderStatus.CANCELLED) continue;
    if (o.fulfillmentType === FulfillmentType.DELIVERY) byType.delivery += 1;
    else if (o.fulfillmentType === FulfillmentType.PICKUP) byType.takeaway += 1;
    else byType.dineIn += 1;
    if (o.orderSource === OrderSource.POS) bySource.pos += 1;
    else bySource.online += 1;

    const hour = Number(
      new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "numeric", hour12: false }).format(o.createdAt)
    );
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);

    const mins = Math.max(0, Math.floor((now.getTime() - o.updatedAt.getTime()) / 60000));
    if (isIncomingOrderLate(o.status, mins, thresholds)) late += 1;
  }

  let peakHour: number | null = null;
  let peakCount = 0;
  for (const [h, c] of hourCounts) {
    if (c > peakCount) {
      peakCount = c;
      peakHour = h;
    }
  }

  const shiftRows = shifts.map((s) => {
    const report = buildShiftReport(s, s.closingCountedCash != null ? Number(s.closingCountedCash) : null);
    const breakdown = shiftCashBreakdown(report.byType);
    return {
      id: s.id,
      cashierId: s.cashierId,
      cashierName: s.cashier.name,
      status: s.status,
      openedAt: s.openedAt.toISOString(),
      closedAt: s.closedAt?.toISOString() ?? null,
      float: roundMoney(Number(s.openingCash)),
      ...breakdown,
      expectedCash: roundMoney(report.expectedCash),
      countedCash: report.counted != null ? roundMoney(report.counted) : null,
      difference: report.variance != null ? roundMoney(report.variance) : null,
    };
  });

  const openShifts = shiftRows.filter((s) => s.status === CashShiftStatus.OPEN);
  const openShiftsBranch = await prisma.cashShift.count({
    where: { branchId, status: CashShiftStatus.OPEN },
  });
  const dayCashFinal =
    openShiftsBranch === 0 &&
    (shiftRows.length === 0 ||
      shiftRows.every((s) => s.status === CashShiftStatus.CLOSED && s.countedCash != null));

  const finalReasons: string[] = [];
  if (openShiftsBranch > 0) finalReasons.push(`${openShiftsBranch} shift(s) still open`);
  if (riderPendingDay.length) finalReasons.push(`${riderPendingDay.length} pending rider cash entr(y/ies) for this day`);
  if (!payment.reconcilesBooked || !payment.reconcilesCollected) finalReasons.push("payment reconciliation mismatch");
  if (payment.missingPaymentMethodOrders.length) {
    finalReasons.push(`${payment.missingPaymentMethodOrders.length} completed order(s) missing payment method`);
  }

  const status = finalReasons.length === 0 && dayCashFinal ? "final" : "provisional";

  const needsAttention: NeedsAttentionItem[] = [];

  if (openShiftsBranch > 0) {
    const openDetail = await prisma.cashShift.findMany({
      where: { branchId, status: CashShiftStatus.OPEN },
      include: {
        cashier: { select: { name: true } },
        movements: true,
      },
      orderBy: { openedAt: "asc" },
    });
    needsAttention.push({
      type: "unclosed_shifts",
      severity: "critical",
      message: `${openShiftsBranch} unclosed shift(s) block cash reconciliation`,
      count: openShiftsBranch,
      link: "/admin/shifts",
      details: openDetail.map((s) => {
        const report = buildShiftReport(s, null);
        return {
          shiftId: s.id,
          cashierName: s.cashier.name,
          openedAt: s.openedAt.toISOString(),
          expectedCash: roundMoney(report.expectedCash),
        };
      }),
    });
  }

  if (riderPendingDay.length) {
    needsAttention.push({
      type: "pending_rider_cash",
      severity: "warning",
      message: `Pending rider cash for this day`,
      count: riderPendingDay.length,
      link: "/admin/rider-cash",
      details: riderPendingDay.map((e) => ({
        riderName: e.rider.name,
        orderNumber: e.order.orderNumber,
        amount: roundMoney(Number(e.collectedAmount)),
        deliveredAt: e.deliveredAt.toISOString(),
        pendingHours: Math.round((Date.now() - e.deliveredAt.getTime()) / 3600000),
      })),
    });
  }

  if (lowStock.length) {
    needsAttention.push({
      type: "low_stock",
      severity: "warning",
      message: `${lowStock.length} SKU(s) below reorder level`,
      count: lowStock.length,
      link: "/admin/inventory?stock=low",
      details: lowStock.map((i) => ({
        name: i.name,
        stock: i.quantity,
        reorderLevel: i.reorderPoint,
        itemId: i.itemId,
      })),
    });
  }

  if (!payment.reconcilesCollected || !payment.reconcilesBooked) {
    needsAttention.push({
      type: "reconciliation_failed",
      severity: "critical",
      message: `Does not add up: difference Rs ${Math.max(Math.abs(payment.bookedDifference), Math.abs(payment.collectedDifference)).toFixed(2)}`,
      count: 1,
      link: "/admin/orders",
      details: [
        { bookedDifference: payment.bookedDifference, collectedDifference: payment.collectedDifference },
      ],
    });
  }

  if (payment.missingPaymentMethodOrders.length) {
    needsAttention.push({
      type: "missing_payment_method",
      severity: "warning",
      message: "Completed orders with no payment method",
      count: payment.missingPaymentMethodOrders.length,
      link: "/admin/orders",
      details: payment.missingPaymentMethodOrders,
    });
  }

  const duplicateMenus = await prisma.menuItem.findMany({
    where: {
      isAvailable: true,
      OR: [
        { name: { contains: "(copy)", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true },
    take: 30,
  });
  const hygieneNames = duplicateMenus.filter((m) => /\(copy\)/i.test(m.name));
  if (hygieneNames.length) {
    needsAttention.push({
      type: "menu_hygiene",
      severity: "info",
      message: `${hygieneNames.length} active dish name(s) look like duplicates`,
      count: hygieneNames.length,
      link: "/admin/catalog/dishes",
      details: hygieneNames,
    });
  }

  const [voidCount, wasteAgg, discountGroups, feedbackAgg, topBlock] = await Promise.all([
    prisma.order.count({
      where: { branchId, voidReasonCode: { not: null }, createdAt: { gte: startUtc, lte: endUtc } },
    }),
    prisma.wasteLog.aggregate({
      where: { branchId, loggedAt: { gte: startUtc, lte: endUtc } },
      _sum: { costAtTime: true },
      _count: true,
    }),
    prisma.order.groupBy({
      by: ["adjustmentReasonCode"],
      where: {
        branchId,
        createdAt: { gte: startUtc, lte: endUtc },
        discountAmount: { gt: 0 },
      },
      _sum: { discountAmount: true },
      _count: { id: true },
    }),
    prisma.orderFeedback.aggregate({
      where: { order: { branchId, createdAt: { gte: startUtc, lte: endUtc } } },
      _avg: { rating: true },
      _count: true,
    }),
    buildTopItems(branchId, startUtc, endUtc, includeMargin),
  ]);

  const lowRatings =
    feedbackAgg._count > 0
      ? await prisma.orderFeedback.findMany({
          where: {
            rating: { lte: 2 },
            order: { branchId, createdAt: { gte: startUtc, lte: endUtc } },
          },
          select: { rating: true, comment: true, order: { select: { orderNumber: true } } },
          take: 10,
        })
      : [];

  const payload: DailyCloseOutPayload = {
    meta: {
      date: dateKey,
      timezone,
      storeDayStart: startUtc.toISOString(),
      storeDayEnd: endUtc.toISOString(),
      generatedAt: new Date().toISOString(),
      status,
      finalReasons,
      branch: { id: branchId, name: branchName },
      definitions: METRIC_DEFINITIONS,
      statusHelp:
        "Final only when every cash shift for this branch is closed (including shifts opened on earlier days), rider cash for this day is settled, and money reconciles. Otherwise provisional.",
    },
    needsAttention,
    money: {
      booked: moneyMetric(metrics.booked, prevDay.booked, prevWeek.booked),
      collected: moneyMetric(metrics.collected, prevDay.collected, prevWeek.collected),
      notYetCollected: payment.notYetCollected,
      paymentSplit: {
        cash: payment.split.cash,
        card: payment.split.card,
        codReceived: payment.split.codReceived,
        unspecified: payment.split.unspecified,
      },
      avgOrderValue: moneyMetric(metrics.avgOrderValue, prevDay.avgOrderValue, prevWeek.avgOrderValue),
      reconciles: {
        booked: payment.reconcilesBooked,
        collected: payment.reconcilesCollected,
        bookedDifference: payment.bookedDifference,
        collectedDifference: payment.collectedDifference,
      },
    },
    cash: {
      shifts: shiftRows,
      dayTotal: dayCashFinal
        ? {
            expectedCash: roundMoney(shiftRows.reduce((s, r) => s + r.expectedCash, 0)),
            countedCash: roundMoney(
              shiftRows.reduce((s, r) => s + (r.countedCash ?? 0), 0)
            ),
            difference: roundMoney(
              shiftRows.reduce((s, r) => s + (r.difference ?? 0), 0)
            ),
            label: "final" as const,
          }
        : {
            expectedCash: roundMoney(shiftRows.reduce((s, r) => s + r.expectedCash, 0)),
            countedCash: null,
            difference: null,
            label: "provisional" as const,
          },
      riderCashPending: riderPendingDay.map((e) => ({
        id: e.id,
        riderName: e.rider.name,
        orderNumber: e.order.orderNumber,
        amount: roundMoney(Number(e.collectedAmount)),
        deliveredAt: e.deliveredAt.toISOString(),
      })),
      riderCashPendingAllTotal: roundMoney(
        riderPendingAll.reduce((s, e) => s + Number(e.collectedAmount), 0)
      ),
    },
    orders: {
      total: intMetric(metrics.ordersCount, prevDay.ordersCount, prevWeek.ordersCount),
      completed: intMetric(metrics.completedCount, prevDay.completedCount, prevWeek.completedCount),
      cancelled: intMetric(metrics.cancelledCount, prevDay.cancelledCount, prevWeek.cancelledCount),
      late: intMetric(late, 0, 0),
      byType,
      bySource,
      peakHour: peakHour != null ? { hour: peakHour, orders: peakCount } : null,
    },
    topItems: topBlock.topItems,
    includedInDeals: topBlock.includedInDeals,
    control: includeControl
      ? {
          discounts: {
            tracked: true,
            count: discountGroups.reduce((s, g) => s + g._count.id, 0),
            total: roundMoney(
              discountGroups.reduce((s, g) => s + Number(g._sum.discountAmount ?? 0), 0)
            ),
            byReason: discountGroups.map((g) => ({
              reason: g.adjustmentReasonCode ?? "Unknown",
              count: g._count.id,
              total: roundMoney(Number(g._sum.discountAmount ?? 0)),
            })),
            auditLink: "/admin/audit-log?category=Orders",
          },
          voids: { tracked: true, count: voidCount, total: null, auditLink: "/admin/audit-log" },
          refunds: {
            tracked: true,
            count: metrics.refundsTotal > 0 ? 1 : 0,
            total: metrics.refundsTotal,
            auditLink: "/admin/audit-log",
          },
          waste: {
            tracked: true,
            count: wasteAgg._count,
            total: roundMoney(Number(wasteAgg._sum.costAtTime ?? 0)),
            auditLink: "/admin/inventory",
          },
        }
      : null,
    inventory: {
      lowStock: lowStock.map((i) => ({
        itemId: i.itemId,
        name: i.name,
        stock: i.quantity,
        reorderLevel: i.reorderPoint,
        unit: i.unit,
      })),
      lowStockCount: lowStock.length,
    },
    feedback:
      feedbackAgg._count > 0
        ? {
            averageRating: Math.round(Number(feedbackAgg._avg.rating ?? 0) * 10) / 10,
            count: feedbackAgg._count,
            lowRatings,
          }
        : null,
    menuHygiene: {
      duplicateLookingNames: hygieneNames,
      note: hygieneNames.length
        ? "Names with “(copy)” usually come from the Duplicate action on Dishes."
        : null,
    },
  };

  if (status === "final" && isPastFinalCandidate) {
    setCached(cacheK, payload, 120_000);
  }

  return payload;
}

/** @deprecated Use buildDailyCloseOut — kept for type references during migration */
export async function buildDailyOwnerSummary(branchId: string, startUtc: Date, endUtc: Date) {
  const metrics = await aggregatePeriodOrderMetrics({ branchId }, startUtc, endUtc);
  const payment = await buildPaymentReconciliation({ branchId }, startUtc, endUtc, metrics.booked);
  return {
    orders: metrics.ordersCount,
    revenue: metrics.booked,
    aov: metrics.avgOrderValue,
    posOrders: 0,
    cashTotal: payment.split.cash,
    cardTotal: payment.split.card,
    discounts: metrics.discountsTotal,
    voids: 0,
    refunds: metrics.refundsTotal,
    topItems: [],
    wasteValue: 0,
    lowStockCount: 0,
    pendingRiderCash: 0,
    pendingRiderCount: 0,
    unclosedShifts: 0,
    costingNote: "",
  };
}
