import {
  FulfillmentType,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  Role,
} from "@prisma/client";
import { prisma } from "../prisma";
import { orderAlertThresholds } from "../order-alert-thresholds";
import { getStoreSettings } from "../settings-data";
import { COMPLETED_STATUSES } from "../dashboard/order-completion";
import { aggregatePeriodOrderMetrics } from "../metrics/period-stats";
import { withComparison, withComparisonInt } from "../metrics/compare";
import {
  allOrdersInPeriodWhere,
  bookedOrderWhere,
  cancelledOrderWhere,
  collectedOrderWhere,
} from "../metrics/definitions";
import { formatChartDayLabel, shiftStoreDateKey, storeDateKey } from "../dashboard/dates";
import { utcRangeForStoreDateKey } from "../dashboard/dates";
import {
  capGranularity,
  parsePreset,
  resolveComparisonRange,
  resolvePresetRange,
  type CompareMode,
  type Granularity,
  type ResolvedRange,
  validateRangeDays,
} from "./range";
import { cacheKey, getCached, setCached } from "./cache";
import { filterAnalyticsForRole, maskPhone } from "./role-filter";
import type { AnalyticsOverview, CategoryRow, ChannelRow, ItemRow } from "./types";
import { recipeUnitCostByMenuId } from "../metrics/menu-recipe-cost";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const STATUS_ORDER: OrderStatus[] = [
  OrderStatus.PENDING_CONFIRMATION,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.COLLECTED,
  OrderStatus.SERVED,
  OrderStatus.CANCELLED,
];

function hourInTz(date: Date, timezone: string) {
  const h = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hour12: false }).format(date);
  return Number(h) % 24;
}

function dowInTz(date: Date, timezone: string) {
  const d = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(date);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[d] ?? 0;
}

function enumerateDateKeys(fromKey: string, toKey: string, timezone: string): string[] {
  const keys: string[] = [];
  let cur = fromKey;
  while (cur <= toKey) {
    keys.push(cur);
    if (cur === toKey) break;
    cur = shiftStoreDateKey(cur, 1, timezone);
  }
  return keys;
}

function paymentLabel(method: PaymentMethod | null) {
  if (method === PaymentMethod.CASH) return "Cash";
  if (method === PaymentMethod.CARD) return "Card";
  return "Unspecified";
}

export type OverviewParams = {
  preset: string;
  from?: string;
  to?: string;
  compare: CompareMode;
  granularity: Granularity;
  branchWhere: { branchId?: string };
  timezone: string;
  role: Role;
  weekStartDay?: number;
  itemsPage?: number;
  itemsPageSize?: number;
  itemsSort?: string;
  itemsOrder?: "asc" | "desc";
  itemsCategory?: string;
  itemsQ?: string;
  minInsightDays?: number;
  minInsightOrders?: number;
};

export async function buildAnalyticsOverview(params: OverviewParams): Promise<AnalyticsOverview> {
  const key = cacheKey(params);
  const cached = getCached<AnalyticsOverview>(key);
  if (cached) return cached;

  const weekStartDay = params.weekStartDay ?? 1;
  const preset = resolvePresetRange(
    parsePreset(params.preset),
    params.timezone,
    new Date(),
    weekStartDay,
    params.from,
    params.to
  );
  validateRangeDays(preset.fromKey, preset.toKey, params.timezone);
  const comparison = resolveComparisonRange(preset, params.compare, params.timezone, weekStartDay);
  const granularity = capGranularity(preset.fromKey, preset.toKey, params.timezone, params.granularity);

  const settings = await getStoreSettings();
  const lateThresholds = orderAlertThresholds(settings);
  const minDays = params.minInsightDays ?? 7;
  const minOrders = params.minInsightOrders ?? 20;

  const [current, previousMetrics] = await Promise.all([
    aggregatePeriodOrderMetrics(params.branchWhere, preset.startUtc, preset.endUtc),
    comparison
      ? aggregatePeriodOrderMetrics(params.branchWhere, comparison.startUtc, comparison.endUtc)
      : Promise.resolve(null),
  ]);

  const customerStats = await computeCustomerStats(
    params.branchWhere,
    preset.startUtc,
    preset.endUtc,
    comparison?.startUtc ?? null
  );

  const kpis = {
    booked: withComparison(current.booked, previousMetrics?.booked ?? 0),
    collected: withComparison(current.collected, previousMetrics?.collected ?? 0),
    ordersCount: withComparisonInt(current.ordersCount, previousMetrics?.ordersCount ?? 0),
    completedCount: withComparisonInt(current.completedCount, previousMetrics?.completedCount ?? 0),
    cancelledCount: withComparisonInt(current.cancelledCount, previousMetrics?.cancelledCount ?? 0),
    avgOrderValue: withComparison(current.avgOrderValue, previousMetrics?.avgOrderValue ?? 0),
    uniqueCustomers: withComparisonInt(customerStats.unique, customerStats.previousUnique),
    newCustomers: withComparisonInt(customerStats.newCount, customerStats.previousNewCount),
    returningCustomers: withComparisonInt(customerStats.returningCount, customerStats.previousReturningCount),
    discountsTotal: withComparison(current.discountsTotal, previousMetrics?.discountsTotal ?? 0),
    refundsTotal: withComparison(current.refundsTotal, previousMetrics?.refundsTotal ?? 0),
  };

  const dataDays = await countDistinctOrderDays(params.branchWhere, preset.startUtc, preset.endUtc, params.timezone);
  const enoughInsights = dataDays >= minDays && current.ordersCount >= minOrders;

  const [series, heatmap, channels, payments, statuses, cancellations, items, categories, promotions, control, profit, feedback, operations] =
    await Promise.all([
      buildSeries(params.branchWhere, preset, comparison, params.timezone, granularity),
      buildHeatmap(params.branchWhere, preset.startUtc, preset.endUtc, params.timezone),
      buildChannels(params.branchWhere, preset, comparison),
      buildPayments(params.branchWhere, preset.startUtc, preset.endUtc),
      buildStatuses(params.branchWhere, preset.startUtc, preset.endUtc),
      buildCancellations(params.branchWhere, preset.startUtc, preset.endUtc, current.ordersCount),
      buildItems(params),
      buildCategories(params.branchWhere, preset, comparison),
      buildPromotions(params.branchWhere, preset.startUtc, preset.endUtc),
      buildControl(params.branchWhere, preset.startUtc, preset.endUtc),
      buildProfit(params.branchWhere, preset.startUtc, preset.endUtc, current.collected),
      buildFeedback(params.branchWhere, preset.startUtc, preset.endUtc),
      buildOperations(params.branchWhere, preset.startUtc, preset.endUtc, params.timezone, lateThresholds),
    ]);

  const totalOrdersForShare = statuses.reduce((s, r) => s + r.count, 0) || 1;
  const completedShare = statuses
    .filter((s) => COMPLETED_STATUSES.includes(s.status as OrderStatus))
    .reduce((s, r) => s + r.count, 0);
  const cancelShare = statuses.find((s) => s.status === OrderStatus.CANCELLED)?.count ?? 0;

  const overview: AnalyticsOverview = {
    meta: {
      timezone: params.timezone,
      range: preset,
      comparison,
      compareMode: params.compare,
      granularity,
      generatedAt: new Date().toISOString(),
      dataDays,
      enoughData: {
        insights: enoughInsights,
        trends: dataDays >= 3,
      },
    },
    kpis,
    series,
    heatmap,
    channels,
    payments,
    statuses: statuses.map((s) => ({
      status: s.status,
      count: s.count,
      share: Math.round((s.count / totalOrdersForShare) * 1000) / 10,
    })),
    outcomes: {
      completionRate: Math.round((completedShare / totalOrdersForShare) * 1000) / 10,
      cancellationRate: Math.round((cancelShare / totalOrdersForShare) * 1000) / 10,
      lostRevenue: cancellations.lostRevenue,
    },
    cancellations,
    items,
    categories,
    attachRate: null,
    customers: customerStats.public,
    operations,
    promotions,
    control,
    profit,
    feedback,
  };

  const filtered = filterAnalyticsForRole(params.role, overview);
  setCached(key, filtered);
  return filtered;
}

async function countDistinctOrderDays(
  bw: { branchId?: string },
  start: Date,
  end: Date,
  timezone: string
) {
  const orders = await prisma.order.findMany({
    where: bookedOrderWhere(bw, start, end),
    select: { createdAt: true },
  });
  const days = new Set(orders.map((o) => storeDateKey(timezone, o.createdAt)));
  return days.size;
}

async function buildSeries(
  bw: { branchId?: string },
  range: ResolvedRange,
  comparison: ResolvedRange | null,
  timezone: string,
  granularity: Granularity
) {
  const keys = enumerateDateKeys(range.fromKey, range.toKey, timezone);
  const compKeys =
    comparison ? enumerateDateKeys(comparison.fromKey, comparison.toKey, timezone) : [];

  const buckets = await Promise.all(
    keys.map(async (key, idx) => {
      const { startUtc, endUtc } = utcRangeForStoreDateKey(key, timezone);
      const m = await aggregatePeriodOrderMetrics(bw, startUtc, endUtc);
      let comparisonOrders = 0;
      let comparisonBooked: number | null = null;
      let comparisonCollected: number | null = null;
      if (comparison && compKeys[idx]) {
        const compRange = utcRangeForStoreDateKey(compKeys[idx], timezone);
        const cm = await aggregatePeriodOrderMetrics(bw, compRange.startUtc, compRange.endUtc);
        comparisonOrders = cm.ordersCount;
        comparisonBooked = cm.booked;
        comparisonCollected = cm.collected;
      }
      return {
        key,
        label: formatChartDayLabel(key, timezone),
        orders: m.ordersCount,
        booked: m.booked,
        collected: m.collected,
        comparisonOrders,
        comparisonBooked,
        comparisonCollected,
      };
    })
  );

  return { buckets };
}

async function buildHeatmap(bw: { branchId?: string }, start: Date, end: Date, timezone: string) {
  const orders = await prisma.order.findMany({
    where: bookedOrderWhere(bw, start, end),
    select: { createdAt: true, total: true },
  });
  const orderGrid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  const revGrid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const o of orders) {
    const dow = dowInTz(o.createdAt, timezone);
    const hour = hourInTz(o.createdAt, timezone);
    orderGrid[dow][hour] += 1;
    revGrid[dow][hour] += Number(o.total);
  }
  return { orders: orderGrid, revenue: revGrid, weekdayLabels: WEEKDAY_LABELS };
}

async function buildChannels(bw: { branchId?: string }, range: ResolvedRange, comparison: ResolvedRange | null) {
  const sources = await channelGroup(bw, range.startUtc, range.endUtc);
  const prev = comparison ? await channelGroup(bw, comparison.startUtc, comparison.endUtc) : null;
  const fulfillment = await fulfillmentGroup(bw, range.startUtc, range.endUtc);
  const prevFul = comparison ? await fulfillmentGroup(bw, comparison.startUtc, comparison.endUtc) : null;

  return {
    sources: mapChannelRows(sources, prev),
    fulfillment: mapChannelRows(fulfillment, prevFul),
  };
}

async function channelGroup(bw: { branchId?: string }, start: Date, end: Date) {
  const rows = await prisma.order.groupBy({
    by: ["orderSource", "fulfillmentType"],
    where: bookedOrderWhere(bw, start, end),
    _count: { id: true },
    _sum: { total: true },
  });
  const map = new Map<string, { orders: number; booked: number; collected: number }>();
  for (const r of rows) {
    let key = "online";
    if (r.fulfillmentType === FulfillmentType.DINE_IN) key = "dine_in";
    else if (r.orderSource === OrderSource.POS) key = "pos";
    const cur = map.get(key) ?? { orders: 0, booked: 0, collected: 0 };
    cur.orders += r._count.id;
    cur.booked += Number(r._sum.total ?? 0);
    map.set(key, cur);
  }
  const collectedRows = await prisma.order.groupBy({
    by: ["orderSource", "fulfillmentType"],
    where: collectedOrderWhere(bw, start, end),
    _sum: { total: true },
  });
  for (const r of collectedRows) {
    let key = "online";
    if (r.fulfillmentType === FulfillmentType.DINE_IN) key = "dine_in";
    else if (r.orderSource === OrderSource.POS) key = "pos";
    const cur = map.get(key) ?? { orders: 0, booked: 0, collected: 0 };
    cur.collected += Number(r._sum.total ?? 0);
    map.set(key, cur);
  }
  return map;
}

async function fulfillmentGroup(bw: { branchId?: string }, start: Date, end: Date) {
  const rows = await prisma.order.groupBy({
    by: ["fulfillmentType"],
    where: bookedOrderWhere(bw, start, end),
    _count: { id: true },
    _sum: { total: true },
  });
  const map = new Map<string, { orders: number; booked: number; collected: number }>();
  for (const r of rows) {
    const key = r.fulfillmentType.toLowerCase();
    map.set(key, {
      orders: r._count.id,
      booked: Number(r._sum.total ?? 0),
      collected: 0,
    });
  }
  const collectedRows = await prisma.order.groupBy({
    by: ["fulfillmentType"],
    where: collectedOrderWhere(bw, start, end),
    _sum: { total: true },
  });
  for (const r of collectedRows) {
    const key = r.fulfillmentType.toLowerCase();
    const cur = map.get(key) ?? { orders: 0, booked: 0, collected: 0 };
    cur.collected += Number(r._sum.total ?? 0);
    map.set(key, cur);
  }
  return map;
}

function mapChannelRows(
  current: Map<string, { orders: number; booked: number; collected: number }>,
  previous: Map<string, { orders: number; booked: number; collected: number }> | null
): ChannelRow[] {
  const total = [...current.values()].reduce((s, v) => s + v.orders, 0) || 1;
  const labels: Record<string, string> = {
    online: "Online",
    pos: "POS",
    dine_in: "Dine-in",
    delivery: "Delivery",
    pickup: "Pickup",
    dine_in_f: "Dine-in",
  };
  return [...current.entries()].map(([key, v]) => {
    const prev = previous?.get(key)?.orders ?? 0;
    const delta = prev === 0 ? null : Math.round(((v.orders - prev) / prev) * 1000) / 10;
    return {
      key,
      label: labels[key] ?? key,
      orders: v.orders,
      booked: Math.round(v.booked * 100) / 100,
      collected: Math.round(v.collected * 100) / 100,
      share: Math.round((v.orders / total) * 1000) / 10,
      deltaOrdersPercent: delta,
    };
  });
}

async function buildPayments(bw: { branchId?: string }, start: Date, end: Date) {
  const rows = await prisma.order.groupBy({
    by: ["paymentMethod"],
    where: bookedOrderWhere(bw, start, end),
    _count: { id: true },
    _sum: { total: true },
  });
  const total = rows.reduce((s, r) => s + Number(r._sum.total ?? 0), 0) || 1;
  return rows.map((r) => ({
    method: r.paymentMethod ?? "UNSPECIFIED",
    label: paymentLabel(r.paymentMethod),
    orders: r._count.id,
    amount: Math.round(Number(r._sum.total ?? 0) * 100) / 100,
    share: Math.round((Number(r._sum.total ?? 0) / total) * 1000) / 10,
  }));
}

async function buildStatuses(bw: { branchId?: string }, start: Date, end: Date) {
  const rows = await prisma.order.groupBy({
    by: ["status"],
    where: allOrdersInPeriodWhere(bw, start, end),
    _count: { id: true },
  });
  const map = new Map(rows.map((r) => [r.status, r._count.id]));
  return STATUS_ORDER.map((status) => ({
    status,
    count: map.get(status) ?? 0,
  })).filter((s) => s.count > 0 || s.status === OrderStatus.CANCELLED);
}

async function buildCancellations(
  bw: { branchId?: string },
  start: Date,
  end: Date,
  ordersInPeriod: number
) {
  const where = cancelledOrderWhere(bw, start, end);
  const [count, sum] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.aggregate({ where, _sum: { total: true } }),
  ]);
  const lost = Number(sum._sum.total ?? 0);
  const events = await prisma.orderEvent.findMany({
    where: { toStatus: OrderStatus.CANCELLED, order: where },
    select: { reason: true },
    take: 500,
  });
  const reasonMap = new Map<string, number>();
  for (const e of events) {
    const r = (e.reason || "Unspecified").trim() || "Unspecified";
    reasonMap.set(r, (reasonMap.get(r) ?? 0) + 1);
  }
  const reasons = [...reasonMap.entries()].map(([reason, c]) => ({ reason, count: c }));
  return {
    count,
    rate: ordersInPeriod + count > 0 ? Math.round((count / (ordersInPeriod + count)) * 1000) / 10 : 0,
    lostRevenue: Math.round(lost * 100) / 100,
    reasonsAvailable: reasons.length > 0,
    reasons,
  };
}

async function buildItems(params: OverviewParams) {
  const page = Math.max(1, params.itemsPage ?? 1);
  const pageSize = Math.min(100, Math.max(5, params.itemsPageSize ?? 20));
  const range = resolvePresetRange(
    parsePreset(params.preset),
    params.timezone,
    new Date(),
    params.weekStartDay ?? 1,
    params.from,
    params.to
  );
  const bookedWhere = bookedOrderWhere(params.branchWhere, range.startUtc, range.endUtc);
  const lines = await prisma.orderItem.findMany({
    where: { order: bookedWhere },
    select: {
      nameAtOrder: true,
      quantity: true,
      priceAtOrder: true,
      menuItemId: true,
      menuItem: { select: { category: true, isAvailable: true, createdAt: true } },
    },
  });
  const map = new Map<string, ItemRow>();
  for (const row of lines) {
    const id = row.menuItemId ?? row.nameAtOrder;
    const rev = Number(row.priceAtOrder) * row.quantity;
    const cur = map.get(id) ?? {
      menuItemId: row.menuItemId,
      name: row.nameAtOrder,
      category: row.menuItem?.category ?? "Other",
      quantity: 0,
      revenue: 0,
      share: 0,
      previousQuantity: 0,
      deltaQuantityPercent: null,
      cost: null,
      marginPercent: null,
      costKnown: false,
    };
    cur.quantity += row.quantity;
    cur.revenue += rev;
    map.set(id, cur);
  }
  const branchId = params.branchWhere.branchId ?? null;
  const menuIds = [...map.values()].map((r) => r.menuItemId).filter(Boolean) as string[];
  const recipeCosts = await recipeUnitCostByMenuId(branchId, menuIds);
  for (const r of map.values()) {
    if (!r.menuItemId) continue;
    const c = recipeCosts.get(r.menuItemId);
    if (!c?.costKnown || c.unitCost == null) {
      r.costKnown = false;
      r.cost = null;
      r.marginPercent = null;
    } else {
      r.costKnown = true;
      r.cost = c.unitCost;
      r.marginPercent = c.marginPercent;
    }
  }

  const totalRev = [...map.values()].reduce((s, r) => s + r.revenue, 0) || 1;
  let rows = [...map.values()].map((r) => {
    const margin =
      r.costKnown && r.cost != null && r.revenue > 0
        ? Math.round(((r.revenue - r.cost * r.quantity) / r.revenue) * 1000) / 10
        : r.marginPercent;
    return {
      ...r,
      revenue: Math.round(r.revenue * 100) / 100,
      share: Math.round((r.revenue / totalRev) * 1000) / 10,
      marginPercent: margin,
    };
  });
  const q = (params.itemsQ || "").trim().toLowerCase();
  if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q));
  if (params.itemsCategory) rows = rows.filter((r) => r.category === params.itemsCategory);
  const sort = params.itemsSort || "revenue";
  const order = params.itemsOrder === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    const av = sort === "qty" ? a.quantity : sort === "margin" ? (a.marginPercent ?? -1) : a.revenue;
    const bv = sort === "qty" ? b.quantity : sort === "margin" ? (b.marginPercent ?? -1) : b.revenue;
    if (av !== bv) return av > bv ? order : -order;
    return a.name.localeCompare(b.name);
  });
  const total = rows.length;
  const paged = rows.slice((page - 1) * pageSize, page * pageSize);

  const activeItems = await prisma.menuItem.findMany({
    where: { isAvailable: true },
    select: { id: true, name: true },
  });
  const soldIds = new Set(rows.filter((r) => r.menuItemId).map((r) => r.menuItemId!));
  const dead = activeItems
    .filter((i) => !soldIds.has(i.id))
    .slice(0, 20)
    .map((i) => ({ menuItemId: i.id, name: i.name }));

  const slowMovers = [...rows]
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, Math.max(1, Math.floor(rows.length * 0.1)))
    .map((r) => ({ menuItemId: r.menuItemId ?? "", name: r.name, quantity: r.quantity }));

  return {
    rows: paged,
    total,
    page,
    pageSize,
    dead,
    slowMovers,
  };
}

async function buildCategories(bw: { branchId?: string }, range: ResolvedRange, comparison: ResolvedRange | null) {
  const cur = await categoryAgg(bw, range.startUtc, range.endUtc);
  const prev = comparison ? await categoryAgg(bw, comparison.startUtc, comparison.endUtc) : new Map();
  const total = [...cur.values()].reduce((s, v) => s + v.revenue, 0) || 1;
  const rows: CategoryRow[] = [...cur.entries()].map(([category, v]) => {
    const p = prev.get(category)?.revenue ?? 0;
    const delta = p === 0 ? null : Math.round(((v.revenue - p) / p) * 1000) / 10;
    return {
      category,
      revenue: Math.round(v.revenue * 100) / 100,
      share: Math.round((v.revenue / total) * 1000) / 10,
      quantity: v.quantity,
      deltaRevenuePercent: delta,
    };
  });
  rows.sort((a, b) => b.revenue - a.revenue);
  return rows;
}

async function categoryAgg(bw: { branchId?: string }, start: Date, end: Date) {
  const lines = await prisma.orderItem.findMany({
    where: { order: bookedOrderWhere(bw, start, end) },
    select: { quantity: true, priceAtOrder: true, menuItem: { select: { category: true } } },
  });
  const map = new Map<string, { revenue: number; quantity: number }>();
  for (const row of lines) {
    const cat = row.menuItem?.category ?? "Other";
    const cur = map.get(cat) ?? { revenue: 0, quantity: 0 };
    cur.quantity += row.quantity;
    cur.revenue += Number(row.priceAtOrder) * row.quantity;
    map.set(cat, cur);
  }
  return map;
}

async function computeCustomerStats(
  bw: { branchId?: string },
  start: Date,
  end: Date,
  comparisonStart: Date | null
) {
  const orders = await prisma.order.findMany({
    where: bookedOrderWhere(bw, start, end),
    select: { customerId: true, customerPhone: true, customerEmail: true, total: true, createdAt: true, customerName: true },
  });
  const identity = (o: { customerId: string | null; customerPhone: string; customerEmail: string | null }) =>
    o.customerId ?? `guest:${o.customerPhone}:${o.customerEmail ?? ""}`;

  const uniqueSet = new Set(orders.map(identity));
  let newCount = 0;
  let returningCount = 0;
  const spendMap = new Map<string, { name: string; phone: string | null; orders: number; spend: number }>();

  const customerIds = [...new Set(orders.map((o) => o.customerId).filter(Boolean))] as string[];
  const guestPhones = [...new Set(orders.filter((o) => !o.customerId).map((o) => o.customerPhone))];

  const [returningCustomerIds, priorGuestOrders] = await Promise.all([
    customerIds.length
      ? prisma.order.findMany({
          where: {
            ...bw,
            customerId: { in: customerIds },
            createdAt: { lt: start },
            status: { not: OrderStatus.CANCELLED },
          },
          select: { customerId: true },
          distinct: ["customerId"],
        })
      : Promise.resolve([]),
    guestPhones.length
      ? prisma.order.findMany({
          where: {
            ...bw,
            customerId: null,
            customerPhone: { in: guestPhones },
            createdAt: { lt: start },
            status: { not: OrderStatus.CANCELLED },
          },
          select: { customerPhone: true, customerEmail: true },
        })
      : Promise.resolve([]),
  ]);

  const returningIdSet = new Set(returningCustomerIds.map((r) => r.customerId).filter(Boolean));
  const returningGuestSet = new Set(
    priorGuestOrders.map((g) => `guest:${g.customerPhone}:${g.customerEmail ?? ""}`)
  );

  for (const o of orders) {
    const id = identity(o);
    const isReturning = o.customerId ? returningIdSet.has(o.customerId) : returningGuestSet.has(id);
    if (isReturning) returningCount += 1;
    else newCount += 1;

    const cur = spendMap.get(id) ?? { name: o.customerName, phone: o.customerPhone, orders: 0, spend: 0 };
    cur.orders += 1;
    cur.spend += Number(o.total);
    spendMap.set(id, cur);
  }

  const freq = { "1": 0, "2": 0, "3-5": 0, "6+": 0 };
  for (const v of spendMap.values()) {
    if (v.orders === 1) freq["1"] += 1;
    else if (v.orders === 2) freq["2"] += 1;
    else if (v.orders <= 5) freq["3-5"] += 1;
    else freq["6+"] += 1;
  }

  let previousUnique = 0;
  let previousNewCount = 0;
  let previousReturningCount = 0;
  if (comparisonStart) {
    const compEnd = new Date(start.getTime() - 1);
    const compOrders = await prisma.order.findMany({
      where: bookedOrderWhere(bw, comparisonStart, compEnd),
      select: { customerId: true, customerPhone: true, customerEmail: true },
    });
    previousUnique = new Set(compOrders.map(identity)).size;
    previousNewCount = 0;
    previousReturningCount = compOrders.length;
  }

  const topCustomers = [...spendMap.values()]
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 10)
    .map((c) => ({ ...c, spend: Math.round(c.spend * 100) / 100 }));

  return {
    unique: uniqueSet.size,
    newCount,
    returningCount,
    previousUnique,
    previousNewCount,
    previousReturningCount,
    public: {
      newCount,
      returningCount,
      repeatRate: uniqueSet.size ? Math.round((returningCount / orders.length) * 1000) / 10 : 0,
      avgOrdersPerCustomer: uniqueSet.size ? Math.round((orders.length / uniqueSet.size) * 100) / 100 : 0,
      frequency: [
        { bucket: "1 order", count: freq["1"] },
        { bucket: "2 orders", count: freq["2"] },
        { bucket: "3–5 orders", count: freq["3-5"] },
        { bucket: "6+ orders", count: freq["6+"] },
      ],
      topCustomers,
    },
  };
}

async function buildPromotions(bw: { branchId?: string }, start: Date, end: Date) {
  const where = { ...bookedOrderWhere(bw, start, end), couponId: { not: null } };
  const [count, discountAgg, revenueAgg, byCoupon] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.aggregate({ where, _sum: { discountAmount: true } }),
    prisma.order.aggregate({ where, _sum: { total: true } }),
    prisma.order.groupBy({
      by: ["couponCode"],
      where,
      _count: { id: true },
      _sum: { discountAmount: true },
    }),
  ]);
  return {
    redemptions: count,
    discountGiven: Math.round(Number(discountAgg._sum.discountAmount ?? 0) * 100) / 100,
    revenueFromCouponOrders: Math.round(Number(revenueAgg._sum.total ?? 0) * 100) / 100,
    topCoupons: byCoupon
      .map((c) => ({
        code: c.couponCode || "—",
        uses: c._count.id,
        discount: Math.round(Number(c._sum.discountAmount ?? 0) * 100) / 100,
      }))
      .sort((a, b) => b.uses - a.uses)
      .slice(0, 10),
  };
}

async function buildControl(bw: { branchId?: string }, start: Date, end: Date) {
  const base = { ...bw, createdAt: { gte: start, lte: end } };
  const [voidOrders, refundAgg, discountAgg, discountOrders] = await Promise.all([
    prisma.order.findMany({
      where: { ...base, voidReasonCode: { not: null } },
      select: { total: true, voidApprovedById: true, createdById: true },
    }),
    prisma.order.aggregate({
      where: { ...base, refundAmount: { not: null } },
      _sum: { refundAmount: true },
      _count: { id: true },
    }),
    prisma.order.aggregate({
      where: { ...base, discountAmount: { gt: 0 } },
      _sum: { discountAmount: true },
      _count: { id: true },
    }),
    prisma.order.findMany({
      where: { ...base, discountAmount: { gt: 0 } },
      select: { discountAmount: true, adjustmentApprovedById: true, createdById: true },
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
  const nameById = new Map(staffUsers.map((u) => [u.id, u.name]));
  const byStaff = staffIds.map((userId) => ({
    userId,
    name: nameById.get(userId) ?? "Staff",
    voidValue: Math.round((staffMap.get(userId)?.voidValue ?? 0) * 100) / 100,
    discountValue: Math.round((staffMap.get(userId)?.discountValue ?? 0) * 100) / 100,
  }));

  return {
    voids: {
      count: voidOrders.length,
      total: Math.round(voidOrders.reduce((s, o) => s + Number(o.total), 0) * 100) / 100,
    },
    refunds: { count: refundAgg._count.id, total: Number(refundAgg._sum.refundAmount ?? 0) },
    discounts: { count: discountAgg._count.id, total: Number(discountAgg._sum.discountAmount ?? 0) },
    byStaff,
  };
}

async function buildProfit(bw: { branchId?: string }, start: Date, end: Date, collected: number) {
  const lines = await prisma.orderItem.findMany({
    where: { order: collectedOrderWhere(bw, start, end) },
    select: { menuItemId: true, quantity: true, priceAtOrder: true },
  });
  const menuIds = [...new Set(lines.map((l) => l.menuItemId).filter(Boolean))] as string[];
  const costs = await recipeUnitCostByMenuId(bw.branchId ?? null, menuIds);

  let revenueKnown = 0;
  let theoreticalCost = 0;
  let revenueTotal = 0;
  for (const line of lines) {
    const rev = Number(line.priceAtOrder) * line.quantity;
    revenueTotal += rev;
    if (!line.menuItemId) continue;
    const c = costs.get(line.menuItemId);
    if (!c?.costKnown || c.unitCost == null) continue;
    revenueKnown += rev;
    theoreticalCost += c.unitCost * line.quantity;
  }
  const grossProfit = Math.round((revenueKnown - theoreticalCost) * 100) / 100;
  const coveragePercent =
    revenueTotal > 0 ? Math.round((revenueKnown / revenueTotal) * 1000) / 10 : 0;
  const lowCoverage = collected > 0 && coveragePercent < 60;

  return {
    grossProfit,
    collected,
    theoreticalCost: Math.round(theoreticalCost * 100) / 100,
    coveragePercent,
    lowCoverage,
  };
}

async function buildFeedback(bw: { branchId?: string }, start: Date, end: Date) {
  const rows = await prisma.orderFeedback.findMany({
    where: { order: bookedOrderWhere(bw, start, end), createdAt: { gte: start, lte: end } },
    select: { rating: true },
  });
  const dist = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    count: rows.filter((r) => r.rating === rating).length,
  }));
  const count = rows.length;
  const avg = count ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : null;
  const settings = await getStoreSettings();
  const low = rows.filter((r) => r.rating <= (settings.lowRatingThreshold ?? 3)).length;
  return { avgRating: avg, count, distribution: dist, lowRatingCount: low };
}

async function buildOperations(
  bw: { branchId?: string },
  start: Date,
  end: Date,
  timezone: string,
  thresholds: { lateConfirmMinutes: number; latePrepMinutes: number; lateDeliveryMinutes: number }
) {
  const orders = await prisma.order.findMany({
    where: allOrdersInPeriodWhere(bw, start, end),
    select: {
      id: true,
      status: true,
      fulfillmentType: true,
      updatedAt: true,
      riderId: true,
      rider: { select: { id: true, name: true } },
      deliveryAreaId: true,
      deliveryArea: { select: { id: true, name: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
    take: 500,
  });

  let prepSum = 0;
  let prepN = 0;
  let delSum = 0;
  let delN = 0;
  let late = 0;
  const riderMap = new Map<string, { name: string; deliveries: number; delSum: number; delN: number }>();
  const areaMap = new Map<string, { name: string; orders: number }>();

  for (const o of orders) {
    const events = o.events;
    const confirmed = events.find((e) => e.toStatus === OrderStatus.CONFIRMED);
    const ready = events.find((e) => e.toStatus === OrderStatus.READY);
    const out = events.find((e) => e.toStatus === OrderStatus.OUT_FOR_DELIVERY);
    const delivered = events.find((e) => e.toStatus === OrderStatus.DELIVERED);
    if (confirmed && ready) {
      const mins = (ready.createdAt.getTime() - confirmed.createdAt.getTime()) / 60000;
      prepSum += mins;
      prepN += 1;
    }
    if (out && delivered) {
      const mins = (delivered.createdAt.getTime() - out.createdAt.getTime()) / 60000;
      delSum += mins;
      delN += 1;
      if (o.riderId && o.rider) {
        const cur = riderMap.get(o.riderId) ?? { name: o.rider.name, deliveries: 0, delSum: 0, delN: 0 };
        cur.deliveries += 1;
        cur.delSum += mins;
        cur.delN += 1;
        riderMap.set(o.riderId, cur);
      }
    }
    const minsInStatus = Math.max(0, (Date.now() - o.updatedAt.getTime()) / 60000);
    if (
      (o.status === OrderStatus.PENDING_CONFIRMATION && minsInStatus >= thresholds.lateConfirmMinutes) ||
      (o.status === OrderStatus.PREPARING && minsInStatus >= thresholds.latePrepMinutes) ||
      (o.status === OrderStatus.OUT_FOR_DELIVERY && minsInStatus >= thresholds.lateDeliveryMinutes)
    ) {
      late += 1;
    }
    const areaKey = o.deliveryAreaId ?? "none";
    const areaName = o.deliveryArea?.name ?? "No area";
    const a = areaMap.get(areaKey) ?? { name: areaName, orders: 0 };
    a.orders += 1;
    areaMap.set(areaKey, a);
  }

  return {
    avgPrepMinutes: prepN ? Math.round((prepSum / prepN) * 10) / 10 : null,
    avgDeliveryMinutes: delN ? Math.round((delSum / delN) * 10) / 10 : null,
    latePercent: orders.length ? Math.round((late / orders.length) * 1000) / 10 : 0,
    stageDurations: [],
    riders: [...riderMap.entries()].map(([riderId, v]) => ({
      riderId,
      name: v.name,
      deliveries: v.deliveries,
      avgDeliveryMinutes: v.delN ? Math.round((v.delSum / v.delN) * 10) / 10 : null,
    })),
    areas: [...areaMap.entries()].map(([areaId, v]) => ({
      areaId: areaId === "none" ? null : areaId,
      name: v.name,
      orders: v.orders,
    })),
  };
}
