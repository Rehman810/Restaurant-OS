import { OrderStatus } from "@prisma/client";
import { prisma } from "../prisma";

function hourInTz(date: Date, timezone: string) {
  const h = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hour12: false }).format(date);
  return Number(h) % 24;
}

function dowInTz(date: Date, timezone: string) {
  const d = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(date);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[d] ?? 0;
}

export async function buildSalesIntelligence(
  branchId: string,
  startUtc: Date,
  endUtc: Date,
  timezone: string
) {
  const orderWhere = {
    branchId,
    status: { not: OrderStatus.CANCELLED },
    createdAt: { gte: startUtc, lte: endUtc },
  };

  const orders = await prisma.order.findMany({
    where: orderWhere,
    select: {
      id: true,
      total: true,
      createdAt: true,
      fulfillmentType: true,
      discountAmount: true,
      voidReasonCode: true,
      createdById: true,
      createdBy: { select: { id: true, name: true } },
    },
  });

  const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  const byDay: { date: string; orders: number; revenue: number; aov: number }[] = [];
  const dayMap = new Map<string, { orders: number; revenue: number }>();

  for (const o of orders) {
    const dow = dowInTz(o.createdAt, timezone);
    const hour = hourInTz(o.createdAt, timezone);
    heatmap[dow][hour] += 1;

    const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(o.createdAt);
    const cur = dayMap.get(dateKey) ?? { orders: 0, revenue: 0 };
    cur.orders += 1;
    cur.revenue += Number(o.total);
    dayMap.set(dateKey, cur);
  }

  for (const [date, v] of [...dayMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    byDay.push({
      date,
      orders: v.orders,
      revenue: Math.round(v.revenue * 100) / 100,
      aov: v.orders ? Math.round((v.revenue / v.orders) * 100) / 100 : 0,
    });
  }

  const byFulfillment = await prisma.order.groupBy({
    by: ["fulfillmentType"],
    where: orderWhere,
    _count: { id: true },
    _sum: { total: true },
  });

  const itemSales = await prisma.orderItem.groupBy({
    by: ["menuItemId"],
    where: { order: orderWhere, menuItemId: { not: undefined } },
    _sum: { quantity: true },
  });
  const menuIds = itemSales.map((i) => i.menuItemId!).filter(Boolean);
  const menus = await prisma.menuItem.findMany({
    where: { id: { in: menuIds } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(menus.map((m) => [m.id, m.name]));
  const sellers = itemSales
    .map((i) => ({
      menuItemId: i.menuItemId!,
      name: nameMap.get(i.menuItemId!) ?? "Unknown",
      quantity: Number(i._sum.quantity ?? 0),
    }))
    .sort((a, b) => b.quantity - a.quantity);

  const staffSales = await prisma.order.groupBy({
    by: ["createdById"],
    where: { ...orderWhere, createdById: { not: null } },
    _count: { id: true },
    _sum: { total: true, discountAmount: true },
  });
  const staffIds = staffSales.map((s) => s.createdById!).filter(Boolean);
  const staff = await prisma.user.findMany({
    where: { id: { in: staffIds } },
    select: { id: true, name: true },
  });
  const staffMap = new Map(staff.map((s) => [s.id, s.name]));

  const voids = await prisma.order.groupBy({
    by: ["voidReasonCode", "createdById"],
    where: {
      branchId,
      voidReasonCode: { not: null },
      createdAt: { gte: startUtc, lte: endUtc },
    },
    _count: { id: true },
  });

  const cancelReasons = await prisma.order.groupBy({
    by: ["adjustmentReasonCode"],
    where: {
      branchId,
      status: OrderStatus.CANCELLED,
      createdAt: { gte: startUtc, lte: endUtc },
    },
    _count: { id: true },
  });

  return {
    heatmap,
    aovTrend: byDay,
    fulfillment: byFulfillment.map((f) => ({
      type: f.fulfillmentType,
      orders: f._count.id,
      revenue: Number(f._sum.total ?? 0),
    })),
    topSellers: sellers.slice(0, 15),
    bottomSellers: [...sellers].reverse().slice(0, 10),
    staffSales: staffSales.map((s) => ({
      staffId: s.createdById,
      name: staffMap.get(s.createdById!) ?? "Staff",
      orders: s._count.id,
      revenue: Number(s._sum.total ?? 0),
      discounts: Number(s._sum.discountAmount ?? 0),
    })),
    voidsByStaff: voids.map((v) => ({
      reason: v.voidReasonCode,
      staffId: v.createdById,
      count: v._count.id,
    })),
    cancellationReasons: cancelReasons.map((c) => ({
      reason: c.adjustmentReasonCode ?? "Unknown",
      count: c._count.id,
    })),
  };
}
