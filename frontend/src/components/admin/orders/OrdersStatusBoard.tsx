"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
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

export function OrdersStatusBoard({
  rows,
  timeZone,
  serverTime,
  role,
  flashIds,
  onOpen,
  onAction,
}: {
  rows: AdminOrderRow[];
  timeZone: string;
  serverTime: string;
  role?: Role;
  flashIds: Set<string>;
  onOpen: (row: AdminOrderRow) => void;
  onAction: (row: AdminOrderRow, action: AdminOrderRow["nextActions"][number]) => void;
}) {
  const anchorMs = new Date(serverTime).getTime();
  const [sideOpen, setSideOpen] = useState(false);

  function cardsFor(column: BoardColumnId | SideColumnId) {
    return rows.filter((r) => rowBelongsInColumn(r, column));
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {MAIN_BOARD_COLUMNS.map((col) => {
        const list = cardsFor(col.id);
        return (
          <section
            key={col.id}
            className="flex w-[min(100%,280px)] shrink-0 flex-col rounded-2xl border border-stone-200 bg-stone-50/80 dark:border-stone-700 dark:bg-stone-800/50"
            aria-label={`${col.label} column`}
          >
            <header className="border-b border-stone-200 px-3 py-2.5 dark:border-stone-700">
              <h3 className="text-xs font-bold uppercase tracking-wide text-stone-600 dark:text-stone-300">
                {col.label}
                <span className="ml-2 rounded-full bg-white px-1.5 py-0.5 text-[10px] text-stone-500 ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-600">
                  {list.length}
                </span>
              </h3>
            </header>
            <div className="flex min-h-[120px] flex-col gap-2 p-2">
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
                    onOpen={() => onOpen(row)}
                    onAction={() => primary && onAction(row, primary)}
                  />
                );
              })}
              {!list.length && (
                <p className="py-6 text-center text-xs text-stone-400">No orders</p>
              )}
            </div>
          </section>
        );
      })}

      <aside className="w-[min(100%,240px)] shrink-0">
        <button
          type="button"
          className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-200"
          onClick={() => setSideOpen((o) => !o)}
          aria-expanded={sideOpen}
        >
          More lanes
          <ChevronDown size={16} className={sideOpen ? "rotate-180" : ""} />
        </button>
        {sideOpen && (
          <div className="mt-2 space-y-2">
            {SIDE_COLUMNS.map((col) => {
              const list = cardsFor(col.id);
              return (
                <section
                  key={col.id}
                  className="rounded-xl border border-stone-200 bg-white p-2 dark:border-stone-700 dark:bg-stone-900"
                >
                  <h4 className="px-1 text-[11px] font-bold uppercase text-stone-500">
                    {col.label} ({list.length})
                  </h4>
                  <div className="mt-2 flex flex-col gap-2">
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
                          onOpen={() => onOpen(row)}
                          onAction={() => primary && onAction(row, primary)}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </aside>
    </div>
  );
}
