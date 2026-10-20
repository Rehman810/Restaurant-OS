import { FulfillmentType, OrderStatus } from "@prisma/client";

export type BoardColumnId =
  | "PENDING_CONFIRMATION"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "COMPLETED";

export const TRACKING_BOARD_COLUMNS: { id: BoardColumnId; label: string }[] = [
  { id: "PENDING_CONFIRMATION", label: "Awaiting confirmation" },
  { id: "CONFIRMED", label: "Confirmed" },
  { id: "PREPARING", label: "Preparing" },
  { id: "READY", label: "Ready" },
  { id: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { id: "COMPLETED", label: "Completed" },
];

const COMPLETED_STATUSES: OrderStatus[] = [
  OrderStatus.DELIVERED,
  OrderStatus.COLLECTED,
  OrderStatus.SERVED,
];

export function boardColumnForStatus(status: OrderStatus): BoardColumnId | "CANCELLED" {
  if (status === OrderStatus.PENDING_CONFIRMATION) return "PENDING_CONFIRMATION";
  if (status === OrderStatus.CANCELLED) return "CANCELLED";
  if (COMPLETED_STATUSES.includes(status)) return "COMPLETED";
  if (status === OrderStatus.OUT_FOR_DELIVERY) return "OUT_FOR_DELIVERY";
  if (status === OrderStatus.READY) return "READY";
  if (status === OrderStatus.PREPARING) return "PREPARING";
  if (status === OrderStatus.CONFIRMED) return "CONFIRMED";
  return "CONFIRMED";
}

/** Dine-in / takeaway never use Out for delivery column. */
export function orderBelongsInColumn(
  status: OrderStatus,
  fulfillmentType: FulfillmentType,
  column: BoardColumnId
): boolean {
  if (column === "OUT_FOR_DELIVERY") {
    return fulfillmentType === FulfillmentType.DELIVERY && status === OrderStatus.OUT_FOR_DELIVERY;
  }
  return boardColumnForStatus(status) === column;
}

export function isCompletedStatus(status: OrderStatus) {
  return COMPLETED_STATUSES.includes(status);
}

export { COMPLETED_STATUSES as BOARD_COMPLETED_STATUSES };
