import type { OrderBoardColumnView } from "./tracking";
import type { BoardColumnId, SideColumnId } from "./board-columns";

const DEFAULT_MOBILE_TABS: (BoardColumnId | SideColumnId)[] = [
  "CONFIRMED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "COMPLETED",
];

/** Phone lane tabs: include Awaiting confirmation when it has cards. */
export function mobileBoardTabIds(columns: OrderBoardColumnView[]): (BoardColumnId | SideColumnId)[] {
  const pending = columns.find((c) => c.id === "PENDING_CONFIRMATION");
  if (pending && pending.count > 0) {
    return ["PENDING_CONFIRMATION", ...DEFAULT_MOBILE_TABS];
  }
  return DEFAULT_MOBILE_TABS;
}
