import type { AdminOrderRow } from "./types";
import type { FulfillmentType, OrderStatus } from "@/lib/types";

export type BoardColumnId =
  | "PENDING_CONFIRMATION"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "COMPLETED";

export type SideColumnId = "PENDING_CONFIRMATION" | "CANCELLED";

export const MAIN_BOARD_COLUMNS: { id: BoardColumnId; label: string }[] = [
  { id: "CONFIRMED", label: "Confirmed" },
  { id: "PREPARING", label: "Preparing" },
  { id: "READY", label: "Ready" },
  { id: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { id: "COMPLETED", label: "Completed" },
];

export const SIDE_COLUMNS: { id: SideColumnId; label: string }[] = [
  { id: "PENDING_CONFIRMATION", label: "Awaiting confirmation" },
  { id: "CANCELLED", label: "Cancelled" },
];

const COMPLETED: OrderStatus[] = ["DELIVERED", "COLLECTED", "SERVED"];

export function boardColumnForRow(row: AdminOrderRow): BoardColumnId | SideColumnId {
  if (row.status === "PENDING_CONFIRMATION") return "PENDING_CONFIRMATION";
  if (row.status === "CANCELLED") return "CANCELLED";
  if (COMPLETED.includes(row.status)) return "COMPLETED";
  if (row.status === "OUT_FOR_DELIVERY") return "OUT_FOR_DELIVERY";
  if (row.status === "READY") return "READY";
  if (row.status === "PREPARING") return "PREPARING";
  if (row.status === "CONFIRMED") return "CONFIRMED";
  return "CONFIRMED";
}

/** Dine-in / takeaway never appear in Out for delivery column (status won't be OUT_FOR_DELIVERY). */
export function rowBelongsInColumn(row: AdminOrderRow, column: BoardColumnId | SideColumnId): boolean {
  if (column === "OUT_FOR_DELIVERY") {
    return row.type === "DELIVERY" && row.status === "OUT_FOR_DELIVERY";
  }
  return boardColumnForRow(row) === column;
}

export function whereLabel(row: AdminOrderRow): string {
  if (row.type === "DINE_IN") return row.table ? `Table ${row.table}` : "No table";
  if (row.type === "PICKUP") return "Pickup";
  return row.address?.area || row.address?.text?.split(",")[0] || "Delivery";
}

export function typeBadgeShort(type: FulfillmentType) {
  if (type === "DINE_IN") return "Dine-in";
  if (type === "PICKUP") return "Takeaway";
  return "Delivery";
}
