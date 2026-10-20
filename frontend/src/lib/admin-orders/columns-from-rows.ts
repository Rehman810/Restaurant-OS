import {
  MAIN_BOARD_COLUMNS,
  SIDE_COLUMNS,
  rowBelongsInColumn,
  type BoardColumnId,
  type SideColumnId,
} from "./board-columns";
import type { AdminOrderRow } from "./types";
import type { OrderBoardColumnView } from "./tracking";

export function columnsFromRows(rows: AdminOrderRow[]): OrderBoardColumnView[] {
  const all = [
    ...MAIN_BOARD_COLUMNS,
    ...SIDE_COLUMNS.filter((c) => c.id === "PENDING_CONFIRMATION"),
  ];
  return all.map((col) => {
    const cards = rows.filter((r) => rowBelongsInColumn(r, col.id as BoardColumnId | SideColumnId));
    const value = col.id === "COMPLETED"
      ? 0
      : cards.reduce((s, c) => s + c.totals.total, 0);
    return {
      id: col.id as BoardColumnId | SideColumnId,
      label: col.label,
      count: cards.length,
      value,
      cards,
    };
  });
}
