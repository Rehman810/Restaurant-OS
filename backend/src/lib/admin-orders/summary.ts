import { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { PIPELINE_STATUSES } from "../dashboard/order-completion";
import { aggregatePeriodOrderMetrics } from "../metrics/period-stats";
import { METRIC_DEFINITIONS } from "../metrics/definitions";
import { deriveOrderPayment, type OrderPaymentRow } from "./payment";
import {
  computeIsLate,
  computeIsStale,
  statusChangedAtFromEvents,
} from "./timing";

type Thresholds = {
  lateConfirmMinutes: number;
  latePrepMinutes: number;
  lateDeliveryMinutes: number;
  ordersStaleHours: number;
};

export async function buildAdminOrdersSummary(
  where: Prisma.OrderWhereInput,
  branchWhere: { branchId?: string },
  rangeStart: Date | undefined,
  rangeEnd: Date | undefined,
  thresholds: Thresholds
) {
  const [grouped, pipelineOrders, bookedMetrics] = await Promise.all([
    prisma.order.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    }),
    prisma.order.findMany({
      where: {
        ...where,
        status: { in: PIPELINE_STATUSES },
      },
      select: {
        id: true,
        status: true,
        updatedAt: true,
        createdAt: true,
        paymentStatus: true,
        paymentMethod: true,
        total: true,
        fulfillmentType: true,
        events: {
          orderBy: { createdAt: "asc" },
          select: { toStatus: true, createdAt: true },
        },
        payments: { select: { method: true, amount: true } },
      },
      take: 2000,
    }),
    rangeStart && rangeEnd
      ? aggregatePeriodOrderMetrics(branchWhere, rangeStart, rangeEnd)
      : null,
  ]);

  const statusCounts: Record<string, number> = {};
  for (const row of grouped) statusCounts[row.status] = row._count._all;

  let active = 0;
  let late = 0;
  let stale = 0;
  let unpaid = 0;

  for (const o of pipelineOrders) {
    active += 1;
    const statusChangedAt = statusChangedAtFromEvents(o.events, o.status, o.updatedAt);
    const minutesInStatus = Math.floor(
      (Date.now() - statusChangedAt.getTime()) / 60_000
    );
    if (computeIsLate(o.status, minutesInStatus, thresholds)) late += 1;
    if (computeIsStale(statusChangedAt, o.status, thresholds.ordersStaleHours)) stale += 1;

    const payRow: OrderPaymentRow = {
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      total: Number(o.total),
      fulfillmentType: o.fulfillmentType,
      status: o.status,
      payments: o.payments.map((p) => ({
        method: p.method,
        amount: Number(p.amount),
      })),
    };
    const derived = deriveOrderPayment(payRow);
    if (derived.status === "unpaid" || derived.status === "cod" || derived.status === "partial") {
      unpaid += 1;
    }
  }

  const completedCount =
    (statusCounts[OrderStatus.DELIVERED] ?? 0) +
    (statusCounts[OrderStatus.COLLECTED] ?? 0) +
    (statusCounts[OrderStatus.SERVED] ?? 0);

  return {
    statusCounts,
    completedCount,
    active,
    late,
    stale,
    unpaid,
    booked: bookedMetrics?.booked ?? null,
    bookedDefinition: METRIC_DEFINITIONS.booked,
  };
}
