import { FulfillmentType, OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import {
  COMPLETED_STATUSES,
  isIncomingOrderLate,
  PIPELINE_STATUSES,
} from "../dashboard/order-completion";
import { METRIC_DEFINITIONS } from "./definitions";
import { statusChangedAtFromEvents } from "../admin-orders/timing";
import { computeIsStale } from "../admin-orders/timing";

export const PIPELINE_VALUE_DEFINITION =
  "Sum of order totals for in-flight pipeline statuses (awaiting confirmation through out for delivery). Excludes completed and cancelled.";

type Thresholds = {
  lateConfirmMinutes: number;
  latePrepMinutes: number;
  lateDeliveryMinutes: number;
  ordersStaleHours: number;
};

type PipelineOrderRow = {
  id: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  riderId: string | null;
  total: Prisma.Decimal;
  updatedAt: Date;
  createdAt: Date;
  events: { toStatus: OrderStatus; createdAt: Date }[];
};

export function computeTrackingBoardSummaryFromOrders(
  pipelineOrders: PipelineOrderRow[],
  thresholds: Thresholds,
  now = new Date()
) {
  let active = 0;
  let late = 0;
  let stale = 0;
  let unassignedDeliveries = 0;
  let pipelineValue = 0;

  for (const o of pipelineOrders) {
    if (o.status === OrderStatus.OUT_FOR_DELIVERY && o.fulfillmentType !== FulfillmentType.DELIVERY) {
      continue;
    }
    active += 1;
    pipelineValue += Number(o.total);

    const statusChangedAt = statusChangedAtFromEvents(o.events, o.status, o.updatedAt);
    const minutesInStatus = Math.floor((now.getTime() - statusChangedAt.getTime()) / 60_000);
    if (isIncomingOrderLate(o.status, minutesInStatus, thresholds)) late += 1;
    if (computeIsStale(statusChangedAt, o.status, thresholds.ordersStaleHours, now)) stale += 1;

    if (
      o.fulfillmentType === FulfillmentType.DELIVERY &&
      !o.riderId &&
      (o.status === OrderStatus.CONFIRMED ||
        o.status === OrderStatus.PREPARING ||
        o.status === OrderStatus.READY)
    ) {
      unassignedDeliveries += 1;
    }
  }

  return {
    active,
    late,
    stale,
    unassignedDeliveries,
    pipelineValue: Math.round(pipelineValue * 100) / 100,
    pipelineValueDefinition: PIPELINE_VALUE_DEFINITION,
    bookedDefinition: METRIC_DEFINITIONS.booked,
  };
}

export async function loadPipelineOrdersForSummary(
  where: Prisma.OrderWhereInput
): Promise<PipelineOrderRow[]> {
  return prisma.order.findMany({
    where: {
      ...where,
      status: { in: PIPELINE_STATUSES },
    },
    select: {
      id: true,
      status: true,
      fulfillmentType: true,
      riderId: true,
      total: true,
      updatedAt: true,
      createdAt: true,
      events: {
        orderBy: { createdAt: "asc" },
        select: { toStatus: true, createdAt: true },
      },
    },
    take: 3000,
  });
}

export async function aggregateTrackingBoardSummary(
  branchWhere: Prisma.OrderWhereInput,
  thresholds: Thresholds
) {
  const pipelineOrders = await loadPipelineOrdersForSummary(branchWhere);
  return computeTrackingBoardSummaryFromOrders(pipelineOrders, thresholds);
}

export { PIPELINE_STATUSES, COMPLETED_STATUSES };
