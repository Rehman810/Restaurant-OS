import { OrderStatus } from "@prisma/client";

/** Terminal success states from the order machine (not cancelled). */
export const COMPLETED_STATUSES: OrderStatus[] = [
  OrderStatus.DELIVERED,
  OrderStatus.COLLECTED,
  OrderStatus.SERVED,
];

export function isCompletedStatus(status: OrderStatus) {
  return COMPLETED_STATUSES.includes(status);
}

/** Active kitchen pipeline statuses (in-flight, not terminal). */
export const PIPELINE_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING_CONFIRMATION,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
];

export function isActiveIncomingStatus(status: OrderStatus) {
  return PIPELINE_STATUSES.includes(status);
}

export function isIncomingOrderLate(
  status: OrderStatus,
  minutesInStatus: number,
  thresholds: { lateConfirmMinutes: number; latePrepMinutes: number; lateDeliveryMinutes: number }
) {
  if (status === OrderStatus.PENDING_CONFIRMATION || status === OrderStatus.CONFIRMED) {
    return minutesInStatus >= thresholds.lateConfirmMinutes;
  }
  if (status === OrderStatus.PREPARING || status === OrderStatus.READY) {
    return minutesInStatus >= thresholds.latePrepMinutes;
  }
  if (status === OrderStatus.OUT_FOR_DELIVERY) {
    return minutesInStatus >= thresholds.lateDeliveryMinutes;
  }
  return false;
}

export type IncomingSortRow = {
  status: OrderStatus;
  minutesInStatus: number;
  updatedAt: string | Date;
};

/** Late orders first, then oldest by last status change. */
export function sortIncomingPipelineOrders<T extends IncomingSortRow>(
  rows: T[],
  thresholds: { lateConfirmMinutes: number; latePrepMinutes: number; lateDeliveryMinutes: number }
): T[] {
  return [...rows].sort((a, b) => {
    const aLate = isIncomingOrderLate(a.status, a.minutesInStatus, thresholds);
    const bLate = isIncomingOrderLate(b.status, b.minutesInStatus, thresholds);
    if (aLate !== bLate) return aLate ? -1 : 1;
    const at = a.updatedAt instanceof Date ? a.updatedAt.getTime() : new Date(a.updatedAt).getTime();
    const bt = b.updatedAt instanceof Date ? b.updatedAt.getTime() : new Date(b.updatedAt).getTime();
    return at - bt;
  });
}
