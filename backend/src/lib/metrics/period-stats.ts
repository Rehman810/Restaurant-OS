import { OrderStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { roundMoney } from "../dashboard/kpi";
import {
  bookedOrderWhere,
  cancelledOrderWhere,
  collectedOrderWhere,
  computeAvgOrderValue,
} from "./definitions";

export type PeriodOrderMetrics = {
  ordersCount: number;
  booked: number;
  collected: number;
  completedCount: number;
  cancelledCount: number;
  avgOrderValue: number;
  discountsTotal: number;
  refundsTotal: number;
};

/** Shared period aggregates for Dashboard and Analytics. */
export async function aggregatePeriodOrderMetrics(
  branchWhere: { branchId?: string },
  startUtc: Date,
  endUtc: Date
): Promise<PeriodOrderMetrics> {
  const bookedWhere = bookedOrderWhere(branchWhere, startUtc, endUtc);
  const collectedWhere = collectedOrderWhere(branchWhere, startUtc, endUtc);
  const cancelledWhere = cancelledOrderWhere(branchWhere, startUtc, endUtc);

  const [ordersCount, bookedAgg, completedCount, collectedAgg, cancelledCount, discountAgg, refundAgg] =
    await Promise.all([
      prisma.order.count({ where: bookedWhere }),
      prisma.order.aggregate({ where: bookedWhere, _sum: { total: true } }),
      prisma.order.count({ where: collectedWhere }),
      prisma.order.aggregate({ where: collectedWhere, _sum: { total: true } }),
      prisma.order.count({ where: cancelledWhere }),
      prisma.order.aggregate({
        where: { ...bookedWhere, discountAmount: { gt: 0 } },
        _sum: { discountAmount: true },
      }),
      prisma.order.aggregate({
        where: {
          ...branchWhere,
          createdAt: { gte: startUtc, lte: endUtc },
          refundAmount: { not: null },
        },
        _sum: { refundAmount: true },
      }),
    ]);

  const booked = Number(bookedAgg._sum.total ?? 0);
  const collected = Number(collectedAgg._sum.total ?? 0);

  return {
    ordersCount,
    booked: roundMoney(booked),
    collected: roundMoney(collected),
    completedCount,
    cancelledCount,
    avgOrderValue: computeAvgOrderValue(collected, completedCount),
    discountsTotal: roundMoney(Number(discountAgg._sum.discountAmount ?? 0)),
    refundsTotal: roundMoney(Number(refundAgg._sum.refundAmount ?? 0)),
  };
}
