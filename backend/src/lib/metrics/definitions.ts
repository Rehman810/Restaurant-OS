import { OrderStatus, Prisma } from "@prisma/client";
import { COMPLETED_STATUSES } from "../dashboard/order-completion";

/** Booked = all non-cancelled orders placed in the period (by createdAt). */
export const METRIC_DEFINITIONS = {
  booked:
    "Sum of order totals for non-cancelled orders placed in the period (createdAt in range).",
  collected:
    "Sum of order totals for completed orders (delivered, picked up, or served) placed in the period.",
  ordersCount: "Count of non-cancelled orders placed in the period.",
  completedCount: "Count of completed orders (delivered, picked up, served) placed in the period.",
  avgOrderValue: "Collected revenue divided by completed order count (0 when no completions).",
  cancelledCount: "Orders with status CANCELLED placed in the period.",
} as const;

export function bookedOrderWhere(
  branchWhere: Prisma.OrderWhereInput,
  startUtc: Date,
  endUtc: Date
): Prisma.OrderWhereInput {
  return {
    ...branchWhere,
    createdAt: { gte: startUtc, lte: endUtc },
    status: { not: OrderStatus.CANCELLED },
  };
}

export function collectedOrderWhere(
  branchWhere: Prisma.OrderWhereInput,
  startUtc: Date,
  endUtc: Date
): Prisma.OrderWhereInput {
  return {
    ...branchWhere,
    createdAt: { gte: startUtc, lte: endUtc },
    status: { in: COMPLETED_STATUSES },
  };
}

export function cancelledOrderWhere(
  branchWhere: Prisma.OrderWhereInput,
  startUtc: Date,
  endUtc: Date
): Prisma.OrderWhereInput {
  return {
    ...branchWhere,
    createdAt: { gte: startUtc, lte: endUtc },
    status: OrderStatus.CANCELLED,
  };
}

export function allOrdersInPeriodWhere(
  branchWhere: Prisma.OrderWhereInput,
  startUtc: Date,
  endUtc: Date
): Prisma.OrderWhereInput {
  return {
    ...branchWhere,
    createdAt: { gte: startUtc, lte: endUtc },
  };
}

export function computeAvgOrderValue(collected: number, completedCount: number) {
  if (!completedCount) return 0;
  return Math.round((collected / completedCount) * 100) / 100;
}
