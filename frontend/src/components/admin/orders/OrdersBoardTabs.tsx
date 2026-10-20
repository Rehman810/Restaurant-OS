"use client";

import { useMemo, useState } from "react";
import type { AdminOrderRow } from "@/lib/admin-orders/types";
import {
  MAIN_BOARD_COLUMNS,
  SIDE_COLUMNS,
  rowBelongsInColumn,
  type BoardColumnId,
  type SideColumnId,
} from "@/lib/admin-orders/board-columns";
import { OrdersBoardCard } from "./OrdersBoardCard";
import type { Role } from "@/lib/types";

const MOBILE_TABS: { id: BoardColumnId | SideColumnId; label: string }[] = [
  ...MAIN_BOARD_COLUMNS,
  ...SIDE_COLUMNS,
];

export function OrdersBoardTabs({
  rows,
  timeZone,
  serverTime,
  role,
  flashIds,
  onOpen,
  onAction,
  onLongPress,
  selectedIds,
}: {
  rows: AdminOrderRow[];
  timeZone: string;
  serverTime: string;
  role?: Role;
  flashIds: Set<string>;
  onOpen: (row: AdminOrderRow) => void;
  onAction: (row: AdminOrderRow, action: AdminOrderRow["nextActions"][number]) => void;
  onLongPress?: (row: AdminOrderRow) => void;
  selectedIds?: Set<string>;
}) {
  const anchorMs = new Date(serverTime).getTime();
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const tab of MOBILE_TABS) {
      m.set(tab.id, rows.filter((r) => rowBelongsInColumn(r, tab.id)).length);
    }
    return m;
  }, [rows]);

  const [tab, setTab] = useState<BoardColumnId | SideColumnId>("CONFIRMED");
  const list = rows.filter((r) => rowBelongsInColumn(r, tab));

  return (
    <div className="space-y-3 lg:hidden">
      <div
        className="-mx-1 flex gap-1 overflow-x-auto pb-1"
        role="tablist"
        aria-label="Order status lanes"
      >
        {MOBILE_TABS.map((t) => {
          const active = tab === t.id;
          const count = counts.get(t.id) ?? 0;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold ring-1 ${
                active
                  ? "bg-brand-50 text-brand-900 ring-brand-200 dark:bg-brand-950/50 dark:text-brand-100"
                  : "bg-white text-stone-600 ring-stone-200 dark:bg-stone-900 dark:text-stone-300"
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              <span className="ml-1 opacity-70">({count})</span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-3" role="tabpanel">
        {list.map((row) => {
          const primary = row.nextActions.find((a) => a.primary);
          return (
            <OrdersBoardCard
              key={row.id}
              row={row}
              timeZone={timeZone}
              anchorMs={anchorMs}
              role={role}
              flash={flashIds.has(row.id)}
              selected={selectedIds?.has(row.id)}
              onOpen={() => onOpen(row)}
              onAction={() => primary && onAction(row, primary)}
              onLongPress={() => onLongPress?.(row)}
            />
          );
        })}
        {!list.length && <p className="py-8 text-center text-sm text-stone-500">No orders in this lane.</p>}
      </div>
    </div>
  );
}
