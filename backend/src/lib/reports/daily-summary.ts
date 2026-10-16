import { CashShiftStatus, OrderSource, OrderStatus, RiderCashEntryStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { lowStockForBranch } from "../inventory/stock";
export async function buildDailyOwnerSummary(branchId: string, startUtc: Date, endUtc: Date) {
  const orderWhere = {
    branchId,
    status: { not: OrderStatus.CANCELLED },
    createdAt: { gte: startUtc, lte: endUtc },
  };

  const [orders, revenueAgg, discounts, voided, refunds, topItems, wasteAgg, lowStock, pendingRider, openShifts] =
    await Promise.all([
      prisma.order.count({ where: orderWhere }),
      prisma.order.aggregate({ where: orderWhere, _sum: { total: true } }),
      prisma.order.aggregate({ where: orderWhere, _sum: { discountAmount: true } }),
      prisma.order.count({
        where: { branchId, voidReasonCode: { not: null }, createdAt: { gte: startUtc, lte: endUtc } },
      }),
      prisma.order.aggregate({
        where: { branchId, refundAmount: { not: null }, createdAt: { gte: startUtc, lte: endUtc } },
        _sum: { refundAmount: true },
      }),
      prisma.orderItem.groupBy({
        by: ["nameAtOrder"],
        where: { order: orderWhere },
        _sum: { quantity: true },
      }),
      prisma.wasteLog.aggregate({
        where: { branchId, loggedAt: { gte: startUtc, lte: endUtc } },
        _sum: { costAtTime: true },
      }),
      lowStockForBranch(branchId),
      prisma.riderCashEntry.aggregate({
        where: { branchId, status: RiderCashEntryStatus.PENDING },
        _sum: { collectedAmount: true },
        _count: { id: true },
      }),
      prisma.cashShift.count({
        where: { branchId, status: CashShiftStatus.OPEN },
      }),
    ]);

  const cashTotal = await prisma.order.aggregate({
    where: { ...orderWhere, paymentMethod: "CASH" },
    _sum: { total: true },
  });
  const cardTotal = await prisma.order.aggregate({
    where: { ...orderWhere, paymentMethod: "CARD" },
    _sum: { total: true },
  });

  const revenue = Number(revenueAgg._sum.total ?? 0);
  const posOrders = await prisma.order.count({
    where: { ...orderWhere, orderSource: OrderSource.POS },
  });

  return {
    orders,
    revenue: Math.round(revenue * 100) / 100,
    aov: orders ? Math.round((revenue / orders) * 100) / 100 : 0,
    posOrders,
    cashTotal: Number(cashTotal._sum.total ?? 0),
    cardTotal: Number(cardTotal._sum.total ?? 0),
    discounts: Number(discounts._sum.discountAmount ?? 0),
    voids: voided,
    refunds: Number(refunds._sum.refundAmount ?? 0),
    topItems: topItems
      .map((t) => ({ name: t.nameAtOrder, qty: Number(t._sum.quantity ?? 0) }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8),
    wasteValue: Number(wasteAgg._sum.costAtTime ?? 0),
    lowStockCount: lowStock.length,
    pendingRiderCash: Number(pendingRider._sum.collectedAmount ?? 0),
    pendingRiderCount: pendingRider._count.id,
    unclosedShifts: openShifts,
    costingNote: "Food cost % uses branch weighted-average ingredient costs where recipes exist.",
  };
}
