import { OrderStatus } from "@prisma/client";
import { isIncomingOrderLate } from "../dashboard/order-completion";

export function statusChangedAtFromEvents(
  events: { toStatus: OrderStatus; createdAt: Date }[],
  currentStatus: OrderStatus,
  fallback: Date
): Date {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].toStatus === currentStatus) return events[i].createdAt;
  }
  return fallback;
}

export function computeAgeSeconds(statusChangedAt: Date, now = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - statusChangedAt.getTime()) / 1000));
}

export function computeIsLate(
  status: OrderStatus,
  minutesInStatus: number,
  thresholds: { lateConfirmMinutes: number; latePrepMinutes: number; lateDeliveryMinutes: number }
): boolean {
  return isIncomingOrderLate(status, minutesInStatus, thresholds);
}

export function computeIsStale(
  statusChangedAt: Date,
  status: OrderStatus,
  staleHours: number,
  now = new Date()
): boolean {
  if (
    status === OrderStatus.DELIVERED ||
    status === OrderStatus.COLLECTED ||
    status === OrderStatus.SERVED ||
    status === OrderStatus.CANCELLED
  ) {
    return false;
  }
  const hours = (now.getTime() - statusChangedAt.getTime()) / (60 * 60 * 1000);
  return hours >= staleHours;
}
