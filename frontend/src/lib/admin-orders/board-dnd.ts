import { boardColumnForRow, type BoardColumnId } from "./board-columns";
import type { AdminOrderRow } from "./types";
import type { OrderStatus } from "@/lib/types";

/** Map a transition target status to the board column that represents it. */
export function columnForTargetStatus(status: OrderStatus, row: AdminOrderRow): BoardColumnId {
  if (status === "DELIVERED" || status === "COLLECTED" || status === "SERVED") return "COMPLETED";
  if (status === "OUT_FOR_DELIVERY") return "OUT_FOR_DELIVERY";
  if (status === "READY") return "READY";
  if (status === "PREPARING") return "PREPARING";
  if (status === "CONFIRMED") return "CONFIRMED";
  if (status === "PENDING_CONFIRMATION") return "PENDING_CONFIRMATION";
  return boardColumnForRow(row) as BoardColumnId;
}

/** Target status when dropping a card onto a pipeline column. */
export function targetStatusForBoardColumn(
  columnId: BoardColumnId,
  row: AdminOrderRow
): OrderStatus | null {
  if (columnId === "PENDING_CONFIRMATION") return "PENDING_CONFIRMATION";
  if (columnId === "CONFIRMED") return "CONFIRMED";
  if (columnId === "PREPARING") return "PREPARING";
  if (columnId === "READY") return "READY";
  if (columnId === "OUT_FOR_DELIVERY") {
    return row.type === "DELIVERY" ? "OUT_FOR_DELIVERY" : null;
  }
  if (columnId === "COMPLETED") {
    if (row.type === "DELIVERY") return "DELIVERED";
    if (row.type === "PICKUP") return "COLLECTED";
    if (row.type === "DINE_IN") return "SERVED";
  }
  return null;
}

/** Only the immediate next column (same as primary action) is a valid drop target. */
export function nextDropColumn(row: AdminOrderRow): BoardColumnId | null {
  const primary = row.nextActions.find((a) => a.primary);
  if (!primary?.targetStatus) return null;
  return columnForTargetStatus(primary.targetStatus, row);
}

export function canDropOnColumn(columnId: BoardColumnId, row: AdminOrderRow): boolean {
  const next = nextDropColumn(row);
  if (!next || next !== columnId) return false;
  const target = targetStatusForBoardColumn(columnId, row);
  return Boolean(target && target !== row.status);
}

export type ColumnDropHighlight = "none" | "target" | "disabled";

export function columnDropHighlight(
  columnId: BoardColumnId | "CANCELLED",
  draggingRow: AdminOrderRow | null
): ColumnDropHighlight {
  if (!draggingRow) return "none";
  const next = nextDropColumn(draggingRow);
  if (next === columnId) return "target";
  if (columnId === "CANCELLED") return "none";
  return "disabled";
}
