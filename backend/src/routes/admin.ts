import crypto from "crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { FulfillmentType, OrderSource, OrderStatus, RiderCashEntryStatus, Role } from "@prisma/client";
import { normalizeBlockEmail, normalizeBlockPhone } from "../lib/blocklist";
import {
  buildCustomerDirectory,
  customerDirectoryStats,
  filterCustomers,
  listCustomerOrders,
  paginateCustomers,
  type CustomerSegmentFilter,
  type CustomerSort,
} from "../lib/customer-directory";
import { getCustomerDetail, updateCustomerNotes } from "../lib/customer-detail";
import { customersToCsv } from "../lib/customer-export";
import { prisma } from "../lib/prisma";
import {
  branchScopeError,
  getDefaultBranchId,
  orderBranchWhere,
  resolveBranchScope,
  riderWhereForScope,
  syncUserBranches,
} from "../lib/branch-scope";
import { ADMIN_LIKE, ORDER_OPS } from "../lib/roles";
import { requireAuth, requireRole } from "../middleware/auth";
import { writeAudit } from "../lib/audit";
import { AuditAction } from "../lib/audit-actions";
import { clientIp } from "../lib/client-ip";
import { sendStaffWelcomeEmail } from "../lib/email";
import { getStoreSettings } from "../lib/settings-data";
import { branchDayRangeUtc } from "../lib/dine-in/branch-time";
import { storeTodayUtcRange } from "../lib/reports/time-range";
import { canAccess, type AppRole } from "../lib/access";
import { buildDashboardSummary, resolveDashboardTimezone } from "../lib/dashboard/summary";
import { registerAnalyticsOverviewRoutes } from "./analytics-overview";
import { legacyPeriodToPreset, resolvePresetRange } from "../lib/analytics/range";
import { aggregatePeriodOrderMetrics } from "../lib/metrics/period-stats";
import { formatChartDayLabel, shiftStoreDateKey } from "../lib/dashboard/dates";
import { utcRangeForStoreDateKey } from "../lib/dashboard/dates";
import { COMPLETED_STATUSES } from "../lib/dashboard/order-completion";

export const adminRouter = Router();

registerAnalyticsOverviewRoutes(adminRouter, requireAuth, requireRole, ADMIN_LIKE);

const orderInclude = {
  items: true,
  rider: { select: { id: true, name: true, phone: true } },
  invoice: true,
  customer: { select: { id: true, name: true, email: true } },
};

function dayStart(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayEnd(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

type AnalyticsPeriod = "today" | "week" | "month" | "year";

function parsePeriod(raw: unknown): AnalyticsPeriod {
  if (raw === "week" || raw === "month" || raw === "year") return raw;
  return "today";
}

async function resolveStoreTimezone(scope: { allBranches: boolean; branchId?: string | null }) {
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

function periodRange(period: AnalyticsPeriod, todayStart?: Date, todayEnd?: Date) {
  const now = new Date();
  const end = todayEnd ?? dayEnd(now);
  const start = todayStart ?? dayStart(now);

  if (period === "week") {
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
  } else if (period === "month") {
    start.setDate(1);
  } else if (period === "year") {
    start.setMonth(0, 1);
  }

  return { start, end, period };
}

async function buildChart(
  period: AnalyticsPeriod,
  start: Date,
  end: Date,
  branchWhere: { branchId?: string } = {}
) {
  const notCancelled = { status: { not: OrderStatus.CANCELLED }, ...branchWhere };

  if (period === "today") {
    const buckets = [];
    for (let h = 0; h < 24; h += 2) {
      const from = new Date(start);
      from.setHours(h, 0, 0, 0);
      const to = new Date(start);
      to.setHours(h + 2, 0, 0, 0);
      const [count, sum] = await Promise.all([
        prisma.order.count({ where: { createdAt: { gte: from, lt: to }, ...notCancelled } }),
        prisma.order.aggregate({
          _sum: { total: true },
          where: { createdAt: { gte: from, lt: to }, ...notCancelled },
        }),
      ]);
      const label =
        h === 0
          ? "12am"
          : h < 12
            ? `${h}am`
            : h === 12
              ? "12pm"
              : `${h - 12}pm`;
      buckets.push({
        date: from.toISOString(),
        label,
        orders: count,
        revenue: Number(sum._sum.total || 0),
      });
    }
    return buckets;
  }

  if (period === "week") {
    const buckets = [];
    const weekStart = dayStart(start);
    for (let i = 0; i < 7; i++) {
      const from = new Date(weekStart);
      from.setDate(weekStart.getDate() + i);
      const to = new Date(from);
      to.setDate(to.getDate() + 1);
      const [count, sum] = await Promise.all([
        prisma.order.count({ where: { createdAt: { gte: from, lt: to }, ...notCancelled } }),
        prisma.order.aggregate({
          _sum: { total: true },
          where: { createdAt: { gte: from, lt: to }, ...notCancelled },
        }),
      ]);
      buckets.push({
        date: from.toISOString().slice(0, 10),
        label: from.toLocaleDateString("en-PK", { weekday: "short" }),
        orders: count,
        revenue: Number(sum._sum.total || 0),
      });
    }
    return buckets;
  }

  if (period === "month") {
    const buckets = [];
    const monthStart = dayStart(start);
    const lastDay = end.getDate();
    for (let d = 1; d <= lastDay; d++) {
      const from = new Date(monthStart.getFullYear(), monthStart.getMonth(), d);
      const to = new Date(from);
      to.setDate(to.getDate() + 1);
      const [count, sum] = await Promise.all([
        prisma.order.count({ where: { createdAt: { gte: from, lt: to }, ...notCancelled } }),
        prisma.order.aggregate({
          _sum: { total: true },
          where: { createdAt: { gte: from, lt: to }, ...notCancelled },
        }),
      ]);
      buckets.push({
        date: from.toISOString().slice(0, 10),
        label: String(d),
        orders: count,
        revenue: Number(sum._sum.total || 0),
      });
    }
    return buckets;
  }

  const buckets = [];
  const year = start.getFullYear();
  for (let m = 0; m <= end.getMonth(); m++) {
    const from = new Date(year, m, 1);
    const to = new Date(year, m + 1, 1);
    const [count, sum] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: from, lt: to }, ...notCancelled } }),
      prisma.order.aggregate({
        _sum: { total: true },
        where: { createdAt: { gte: from, lt: to }, ...notCancelled },
      }),
    ]);
    buckets.push({
      date: from.toISOString().slice(0, 10),
      label: from.toLocaleDateString("en-PK", { month: "short" }),
      orders: count,
      revenue: Number(sum._sum.total || 0),
    });
  }
  return buckets;
}

adminRouter.get("/dashboard/summary", requireAuth, async (req, res) => {
  const role = req.user!.role as AppRole;
  if (!canAccess(role, "dashboard")) {
    return res.status(403).json({ error: "You do not have access to this area." });
  }
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }
  const timezone = await resolveDashboardTimezone(scope);
  const summary = await buildDashboardSummary(scope.where, timezone, req.user!.role);
  res.setHeader("Cache-Control", "no-store");
  return res.json(summary);
});

adminRouter.get("/stats", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }
  const bw = scope.where;

  const timezone = await resolveStoreTimezone(scope);
  const { start, end: todayEnd } = storeTodayUtcRange(timezone);
  const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);

  const [
    todayOrders,
    todayRevenueAgg,
    monthRevenueAgg,
    monthOrders,
    awaitingConfirmation,
    pending,
    preparing,
    out,
    deliveredToday,
    cancelledToday,
    menuCount,
    customerCount,
    totalOrders,
    totalRevenueAgg,
    riders,
    allOrderItems,
    recentOrders,
    posTodayOrders,
    posTodayRevenueAgg,
  ] = await Promise.all([
    prisma.order.count({
      where: { ...bw, createdAt: { gte: start, lte: todayEnd }, status: { not: OrderStatus.CANCELLED } },
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: { ...bw, createdAt: { gte: start, lte: todayEnd }, status: { not: OrderStatus.CANCELLED } },
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: { ...bw, createdAt: { gte: monthStart }, status: { not: OrderStatus.CANCELLED } },
    }),
    prisma.order.count({
      where: { ...bw, createdAt: { gte: monthStart }, status: { not: OrderStatus.CANCELLED } },
    }),
    prisma.order.count({ where: { ...bw, status: OrderStatus.PENDING_CONFIRMATION } }),
    prisma.order.count({ where: { ...bw, status: OrderStatus.CONFIRMED } }),
    prisma.order.count({ where: { ...bw, status: OrderStatus.PREPARING } }),
    prisma.order.count({ where: { ...bw, status: OrderStatus.OUT_FOR_DELIVERY } }),
    prisma.order.count({
      where: { ...bw, createdAt: { gte: start, lte: todayEnd }, status: OrderStatus.DELIVERED },
    }),
    prisma.order.count({
      where: { ...bw, createdAt: { gte: start, lte: todayEnd }, status: OrderStatus.CANCELLED },
    }),
    prisma.menuItem.count(),
    prisma.user.count({ where: { role: Role.CUSTOMER } }),
    prisma.order.count({ where: { ...bw, status: { not: OrderStatus.CANCELLED } } }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: { ...bw, status: { not: OrderStatus.CANCELLED } },
    }),
    prisma.user.findMany({
      where: { role: Role.RIDER },
      select: { id: true, name: true, phone: true },
    }),
    prisma.orderItem.findMany({
      where: { order: { ...bw, createdAt: { gte: monthStart }, status: { not: OrderStatus.CANCELLED } } },
      select: { nameAtOrder: true, quantity: true, priceAtOrder: true, menuItem: { select: { category: true } } },
    }),
    prisma.order.findMany({
      where: bw,
      take: 8,
      orderBy: { createdAt: "desc" },
      include: orderInclude,
    }),
    prisma.order.count({
      where: {
        ...bw,
        createdAt: { gte: start, lte: todayEnd },
        status: { not: OrderStatus.CANCELLED },
        orderSource: OrderSource.POS,
      },
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        ...bw,
        createdAt: { gte: start, lte: todayEnd },
        status: { not: OrderStatus.CANCELLED },
        orderSource: OrderSource.POS,
      },
    }),
  ]);

  const todayRevenue = Number(todayRevenueAgg._sum.total || 0);
  const monthRevenue = Number(monthRevenueAgg._sum.total || 0);
  const totalRevenue = Number(totalRevenueAgg._sum.total || 0);

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const from = dayStart();
    from.setDate(from.getDate() - i);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    const [count, sum] = await Promise.all([
      prisma.order.count({
        where: { ...bw, createdAt: { gte: from, lt: to }, status: { not: OrderStatus.CANCELLED } },
      }),
      prisma.order.aggregate({
        _sum: { total: true },
        where: { ...bw, createdAt: { gte: from, lt: to }, status: { not: OrderStatus.CANCELLED } },
      }),
    ]);
    days.push({
      date: from.toISOString().slice(0, 10),
      label: from.toLocaleDateString("en-PK", { weekday: "short" }),
      orders: count,
      revenue: Number(sum._sum.total || 0),
    });
  }

  const itemMap = new Map<string, { name: string; qty: number; revenue: number }>();
  const catMap = new Map<string, { revenue: number; orders: number }>();
  for (const row of allOrderItems) {
    const rev = Number(row.priceAtOrder) * row.quantity;
    const cur = itemMap.get(row.nameAtOrder) || { name: row.nameAtOrder, qty: 0, revenue: 0 };
    cur.qty += row.quantity;
    cur.revenue += rev;
    itemMap.set(row.nameAtOrder, cur);
    const cat = row.menuItem?.category || "Other";
    const c = catMap.get(cat) || { revenue: 0, orders: 0 };
    c.revenue += rev;
    c.orders += row.quantity;
    catMap.set(cat, c);
  }

  const topItems = [...itemMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 6);
  const categoryBreakdown = [...catMap.entries()].map(([category, v]) => ({ category, ...v }));

  const statusCounts = await prisma.order.groupBy({
    by: ["status"],
    where: bw,
    _count: { status: true },
  });
  const statusBreakdown = Object.fromEntries(
    statusCounts.map((s) => [s.status, s._count.status])
  ) as Record<string, number>;

  const storeSettings = await getStoreSettings();
  const staleHours = storeSettings.riderCashStaleHours ?? 24;
  const staleBefore = new Date(Date.now() - staleHours * 60 * 60 * 1000);
  const pendingRiderCash = await prisma.riderCashEntry.findMany({
    where: { ...bw, status: RiderCashEntryStatus.PENDING },
    select: { collectedAmount: true, deliveredAt: true },
  });
  const riderCashPendingTotal = pendingRiderCash.reduce((s, e) => s + Number(e.collectedAmount), 0);
  const riderCashStaleCount = pendingRiderCash.filter((e) => e.deliveredAt < staleBefore).length;

  const ridersWithStats = await Promise.all(
    riders.map(async (r) => {
      const [active, completedToday] = await Promise.all([
        prisma.order.count({
          where: { ...bw, riderId: r.id, status: OrderStatus.OUT_FOR_DELIVERY },
        }),
        prisma.order.count({
          where: { ...bw, riderId: r.id, status: OrderStatus.DELIVERED, createdAt: { gte: start } },
        }),
      ]);
      return { ...r, activeDeliveries: active, completedToday };
    })
  );

  res.json({
    todayOrders,
    todayRevenue,
    monthOrders,
    monthRevenue,
    avgOrderValue: todayOrders ? Math.round(todayRevenue / todayOrders) : 0,
    monthAvgOrderValue: monthOrders ? Math.round(monthRevenue / monthOrders) : 0,
    awaitingConfirmation,
    pending,
    preparing,
    outForDelivery: out,
    deliveredToday,
    cancelledToday,
    menuCount,
    customerCount,
    totalOrders,
    totalRevenue,
    riders: ridersWithStats,
    chart: days,
    topItems,
    categoryBreakdown,
    statusBreakdown,
    recentOrders,
    posTodayOrders,
    posTodayRevenue: Number(posTodayRevenueAgg._sum.total || 0),
    riderCashPendingTotal,
    riderCashPendingCount: pendingRiderCash.length,
    riderCashStaleCount,
  });
});

adminRouter.get("/analytics", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }
  const bw = scope.where;

  const period = parsePeriod(req.query.period);
  const timezone = await resolveStoreTimezone(scope);
  const preset = legacyPeriodToPreset(period);
  const resolved = resolvePresetRange(preset, timezone);
  const metrics = await aggregatePeriodOrderMetrics(bw, resolved.startUtc, resolved.endUtc);

  const orderWhere = { ...bw, createdAt: { gte: resolved.startUtc, lte: resolved.endUtc }, status: { not: OrderStatus.CANCELLED } };
  const [orderItems, statusCounts, customersInPeriod] = await Promise.all([
    prisma.orderItem.findMany({
      where: { order: orderWhere },
      select: {
        nameAtOrder: true,
        quantity: true,
        priceAtOrder: true,
        menuItem: { select: { category: true } },
      },
    }),
    prisma.order.groupBy({
      by: ["status"],
      where: { ...bw, createdAt: { gte: resolved.startUtc, lte: resolved.endUtc } },
      _count: { status: true },
    }),
    prisma.order.findMany({
      where: orderWhere,
      select: { customerId: true, customerPhone: true },
    }),
  ]);

  const chart = await buildLegacyChart(period, resolved.fromKey, resolved.toKey, timezone, bw);

  const itemMap = new Map<string, { name: string; qty: number; revenue: number }>();
  const catMap = new Map<string, { revenue: number; orders: number }>();
  for (const row of orderItems) {
    const rev = Number(row.priceAtOrder) * row.quantity;
    const cur = itemMap.get(row.nameAtOrder) || { name: row.nameAtOrder, qty: 0, revenue: 0 };
    cur.qty += row.quantity;
    cur.revenue += rev;
    itemMap.set(row.nameAtOrder, cur);
    const cat = row.menuItem?.category || "Other";
    const c = catMap.get(cat) || { revenue: 0, orders: 0 };
    c.revenue += rev;
    c.orders += row.quantity;
    catMap.set(cat, c);
  }

  const uniqueCustomers = new Set(
    customersInPeriod.map((c) => c.customerId ?? `guest:${c.customerPhone}`)
  ).size;

  const periodLabels: Record<AnalyticsPeriod, string> = {
    today: "Today",
    week: "This week",
    month: "This month",
    year: "This year",
  };

  res.json({
    period,
    periodLabel: periodLabels[period],
    range: {
      from: resolved.fromKey,
      to: resolved.toKey,
    },
    revenue: metrics.collected,
    booked: metrics.booked,
    orders: metrics.ordersCount,
    avgOrderValue: metrics.avgOrderValue,
    delivered: metrics.completedCount,
    customers: uniqueCustomers,
    chart,
    topItems: [...itemMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 8),
    categoryBreakdown: [...catMap.entries()]
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.revenue - a.revenue),
    statusBreakdown: Object.fromEntries(statusCounts.map((s) => [s.status, s._count.status])),
  });
});

async function buildLegacyChart(
  period: AnalyticsPeriod,
  fromKey: string,
  toKey: string,
  timezone: string,
  branchWhere: { branchId?: string }
) {
  const notCancelled = { status: { not: OrderStatus.CANCELLED }, ...branchWhere };
  if (period === "today") {
    const { startUtc } = utcRangeForStoreDateKey(fromKey, timezone);
    const buckets = [];
    for (let h = 0; h < 24; h += 2) {
      const from = new Date(startUtc);
      from.setUTCHours(from.getUTCHours() + h);
      const to = new Date(from);
      to.setUTCHours(to.getUTCHours() + 2);
      const [count, sum, collectedSum] = await Promise.all([
        prisma.order.count({ where: { createdAt: { gte: from, lt: to }, ...notCancelled } }),
        prisma.order.aggregate({ _sum: { total: true }, where: { createdAt: { gte: from, lt: to }, ...notCancelled } }),
        prisma.order.aggregate({
          _sum: { total: true },
          where: { createdAt: { gte: from, lt: to }, status: { in: COMPLETED_STATUSES }, ...branchWhere },
        }),
      ]);
      const label = h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`;
      buckets.push({
        date: from.toISOString(),
        label,
        orders: count,
        revenue: Number(collectedSum._sum.total || 0),
        booked: Number(sum._sum.total || 0),
      });
    }
    return buckets;
  }

  const keys: string[] = [];
  let cur = fromKey;
  while (cur <= toKey) {
    keys.push(cur);
    if (cur === toKey) break;
    cur = shiftStoreDateKey(cur, 1, timezone);
  }

  const buckets = [];
  for (const key of keys) {
    const { startUtc, endUtc } = utcRangeForStoreDateKey(key, timezone);
    const [count, bookedAgg, collectedAgg] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: startUtc, lte: endUtc }, ...notCancelled } }),
      prisma.order.aggregate({ _sum: { total: true }, where: { createdAt: { gte: startUtc, lte: endUtc }, ...notCancelled } }),
      prisma.order.aggregate({
        _sum: { total: true },
        where: { createdAt: { gte: startUtc, lte: endUtc }, status: { in: COMPLETED_STATUSES }, ...branchWhere },
      }),
    ]);
    buckets.push({
      date: key,
      label: period === "year" ? key.slice(0, 7) : formatChartDayLabel(key, timezone),
      orders: count,
      revenue: Number(collectedAgg._sum.total || 0),
      booked: Number(bookedAgg._sum.total || 0),
    });
  }
  return buckets;
}

function customerContactKey(phone: string, email: string | null | undefined) {
  const phoneKey = normalizeBlockPhone(phone);
  if (phoneKey) return `phone:${phoneKey}`;
  const emailKey = normalizeBlockEmail(email);
  if (emailKey) return `email:${emailKey}`;
  return null;
}

adminRouter.get("/customers/export", requireAuth, requireRole(...ORDER_OPS), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }
  const branchId = scope.allBranches ? null : scope.branchId;
  const search = String(req.query.search || "").trim();
  const sortRaw = String(req.query.sort || "spent");
  const sort: CustomerSort =
    sortRaw === "orders" || sortRaw === "name" || sortRaw === "recent" ? sortRaw : "spent";
  const segmentRaw = String(req.query.segment || "all");
  const segment: CustomerSegmentFilter =
    segmentRaw === "new" ||
    segmentRaw === "regular" ||
    segmentRaw === "vip" ||
    segmentRaw === "at_risk" ||
    segmentRaw === "lapsed"
      ? segmentRaw
      : "all";

  const directory = await buildCustomerDirectory(branchId);
  const filtered = filterCustomers(directory, search, sort, segment);
  const csv = customersToCsv(filtered);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="customers.csv"');
  res.send(csv);
});

adminRouter.get("/customers/stats", requireAuth, requireRole(...ORDER_OPS), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }
  const branchId = scope.allBranches ? null : scope.branchId;
  const directory = await buildCustomerDirectory(branchId);
  res.json(customerDirectoryStats(directory));
});

adminRouter.get("/customers/:customerId", requireAuth, requireRole(...ORDER_OPS), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }
  const branchId = scope.allBranches ? null : scope.branchId;
  const detail = await getCustomerDetail(req.params.customerId, branchId);
  if (!detail) return res.status(404).json({ error: "Customer not found." });
  res.json({
    ...detail,
    createdAt: detail.createdAt.toISOString(),
    joinedSource: detail.isGuest ? "first_order" : "account",
    firstOrderAt: detail.firstOrderAt?.toISOString() ?? null,
    lastOrderAt: detail.lastOrderAt?.toISOString() ?? null,
    notesUpdatedAt: detail.notesUpdatedAt,
    lastOrder: detail.lastOrder
      ? { ...detail.lastOrder, createdAt: detail.lastOrder.createdAt.toISOString() }
      : null,
    recentOrders: detail.recentOrders.map((o) => ({
      ...o,
      createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : o.createdAt,
    })),
  });
});

adminRouter.patch("/customers/:customerId/notes", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const { internalNotes } = req.body as { internalNotes?: string };
  if (typeof internalNotes !== "string") {
    return res.status(400).json({ error: "internalNotes is required." });
  }
  const profile = await updateCustomerNotes(req.params.customerId, internalNotes);
  if (!profile) return res.status(404).json({ error: "Customer not found." });
  await writeAudit(prisma, {
    actorId: req.user!.id,
    actorRole: req.user!.role,
    action: AuditAction.CUSTOMER_UPDATED,
    entityType: "customer",
    entityId: req.params.customerId,
    after: { internalNotes: profile.internalNotes },
    ip: clientIp(req),
  });
  res.json({
    internalNotes: profile.internalNotes,
    updatedAt: profile.updatedAt.toISOString(),
  });
});

adminRouter.get("/customers/:customerId/orders", requireAuth, requireRole(...ORDER_OPS), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }
  const branchId = scope.allBranches ? null : scope.branchId;
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const result = await listCustomerOrders(req.params.customerId, limit, offset, branchId);
  if (!result) return res.status(404).json({ error: "Customer not found." });
  res.json(result);
});

adminRouter.get("/customers", requireAuth, requireRole(...ORDER_OPS), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }
  const branchId = scope.allBranches ? null : scope.branchId;

  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const search = String(req.query.search || "").trim();
  const sortRaw = String(req.query.sort || "spent");
  const sort: CustomerSort =
    sortRaw === "orders" || sortRaw === "name" || sortRaw === "recent" ? sortRaw : "spent";
  const segmentRaw = String(req.query.segment || "all");
  const segment: CustomerSegmentFilter =
    segmentRaw === "new" ||
    segmentRaw === "regular" ||
    segmentRaw === "vip" ||
    segmentRaw === "at_risk" ||
    segmentRaw === "lapsed"
      ? segmentRaw
      : "all";

  const directory = await buildCustomerDirectory(branchId);
  const filtered = filterCustomers(directory, search, sort, segment);
  const { customers, total } = paginateCustomers(filtered, limit, offset);

  res.json({
    customers: customers.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      joinedSource: c.isGuest ? "first_order" : "account",
      lastOrder: c.lastOrder
        ? {
            ...c.lastOrder,
            createdAt: c.lastOrder.createdAt.toISOString(),
          }
        : null,
    })),
    total,
    limit,
    offset,
    stats: customerDirectoryStats(directory),
  });
});

adminRouter.get("/riders/summary", requireAuth, requireRole(...ORDER_OPS), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }
  const orderBranch = orderBranchWhere(scope);
  const riderWhere = { ...riderWhereForScope(scope), isActive: true };

  const riders = await prisma.user.findMany({
    where: riderWhere,
    select: { id: true, name: true, phone: true },
    orderBy: { name: "asc" },
  });
  const activeCounts = await prisma.order.groupBy({
    by: ["riderId"],
    where: { riderId: { not: null }, status: OrderStatus.OUT_FOR_DELIVERY, ...orderBranch },
    _count: { _all: true },
  });
  const countMap = new Map(
    activeCounts.filter((row) => row.riderId).map((row) => [row.riderId!, row._count._all])
  );
  res.json(
    riders.map((rider) => ({
      ...rider,
      activeDeliveries: countMap.get(rider.id) ?? 0,
    }))
  );
});

adminRouter.post("/riders", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }

  const { name, email, phone, password } = req.body as {
    name?: string;
    email?: string;
    phone?: string;
    password?: string;
  };

  if (!name?.trim() || !email?.trim()) {
    return res.status(400).json({ error: "Name and email are required." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) return res.status(409).json({ error: "An account with this email already exists." });

  const plainPassword = password?.trim() || crypto.randomBytes(9).toString("base64url");
  if (plainPassword.length < 6) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  const rider = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      phone: phone?.trim() || null,
      passwordHash: await bcrypt.hash(plainPassword, 10),
      role: Role.RIDER,
    },
    select: { id: true, name: true, email: true, phone: true },
  });

  const branchId = scope.allBranches ? await getDefaultBranchId() : scope.branchId!;
  try {
    await syncUserBranches(rider.id, [branchId]);
  } catch (err) {
    await prisma.user.delete({ where: { id: rider.id } });
    const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 400;
    const message = err instanceof Error ? err.message : "Invalid branches";
    return res.status(status).json({ error: message });
  }

  void sendStaffWelcomeEmail(rider.email, rider.name, Role.RIDER, password?.trim() ? undefined : plainPassword);

  res.status(201).json({
    ...rider,
    activeOrders: [],
    deliveredCount: 0,
    totalAssigned: 0,
  });
});

adminRouter.get("/riders", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }
  const orderBranch = orderBranchWhere(scope);
  const riderScope = riderWhereForScope(scope);

  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const search = String(req.query.search || "").trim().toLowerCase();

  const riders = await prisma.user.findMany({
    where: {
      AND: [
        riderScope,
        ...(search
          ? [
              {
                OR: [
                  { name: { contains: search, mode: "insensitive" as const } },
                  { email: { contains: search, mode: "insensitive" as const } },
                  { phone: { contains: search } },
                ],
              },
            ]
          : []),
      ],
    },
    select: { id: true, name: true, email: true, phone: true },
    orderBy: { name: "asc" },
  });

  const page = riders.slice(offset, offset + limit);
  const riderIds = page.map((r) => r.id);

  const [activeOrders, deliveredCounts, totalCounts] = riderIds.length
    ? await Promise.all([
        prisma.order.findMany({
          where: { riderId: { in: riderIds }, status: OrderStatus.OUT_FOR_DELIVERY, ...orderBranch },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            createdAt: true,
            fulfillmentType: true,
            customerName: true,
            deliveryAddress: true,
            riderId: true,
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.order.groupBy({
          by: ["riderId"],
          where: { riderId: { in: riderIds }, status: OrderStatus.DELIVERED, ...orderBranch },
          _count: { _all: true },
        }),
        prisma.order.groupBy({
          by: ["riderId"],
          where: { riderId: { in: riderIds }, ...orderBranch },
          _count: { _all: true },
        }),
      ])
    : [[], [], []];

  const deliveredMap = new Map(
    deliveredCounts.filter((row) => row.riderId).map((row) => [row.riderId!, row._count._all])
  );
  const totalMap = new Map(
    totalCounts.filter((row) => row.riderId).map((row) => [row.riderId!, row._count._all])
  );
  const activeByRider = new Map<string, typeof activeOrders>();
  for (const order of activeOrders) {
    if (!order.riderId) continue;
    const list = activeByRider.get(order.riderId) ?? [];
    list.push(order);
    activeByRider.set(order.riderId, list);
  }

  const [fleetTotal, activeDrops, deliveredAll] = await Promise.all([
    prisma.user.count({ where: riderScope }),
    prisma.order.count({
      where: { status: OrderStatus.OUT_FOR_DELIVERY, riderId: { not: null }, ...orderBranch },
    }),
    prisma.order.count({
      where: { status: OrderStatus.DELIVERED, riderId: { not: null }, ...orderBranch },
    }),
  ]);
  const onRoad = await prisma.user.count({
    where: {
      ...riderScope,
      assignedOrders: { some: { status: OrderStatus.OUT_FOR_DELIVERY, ...orderBranch } },
    },
  });

  res.json({
    riders: page.map((rider) => ({
      ...rider,
      activeOrders: (activeByRider.get(rider.id) ?? []).map((order) => ({
        ...order,
        total: Number(order.total),
      })),
      deliveredCount: deliveredMap.get(rider.id) ?? 0,
      totalAssigned: totalMap.get(rider.id) ?? 0,
    })),
    total: riders.length,
    limit,
    offset,
    stats: {
      total: fleetTotal,
      onRoad,
      activeDrops,
      delivered: deliveredAll,
      available: Math.max(0, fleetTotal - onRoad),
    },
  });
});

adminRouter.post("/branches/:id/members", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const branch = await prisma.branch.findUnique({ where: { id: req.params.id } });
  if (!branch) return res.status(404).json({ error: "Branch not found." });
  const userIds = Array.isArray(req.body?.userIds) ? (req.body.userIds as string[]) : [];
  if (!userIds.length) return res.status(400).json({ error: "userIds array is required." });

  await prisma.branchMember.createMany({
    data: userIds.map((userId) => ({ userId, branchId: branch.id })),
    skipDuplicates: true,
  });
  res.json({ ok: true });
});
