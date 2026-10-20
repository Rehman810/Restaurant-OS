"use client";

import type { AdminOrderRow } from "@/lib/admin-orders/types";
import {
  formatAgeSeconds,
  paymentCellLabel,
} from "@/lib/admin-orders/helpers";
import { typeBadgeShort, whereLabel } from "@/lib/admin-orders/board-columns";
import { pkr } from "@/lib/format";
import type { Role } from "@/lib/types";

export function OrdersBoardCard({
  row,
  timeZone,
  anchorMs,
  role,
  flash,
  onOpen,
  onAction,
  onLongPress,
  selected,
}: {
  row: AdminOrderRow;
  timeZone: string;
  anchorMs: number;
  role?: Role;
  flash?: boolean;
  onOpen: () => void;
  onAction: () => void;
  onLongPress?: () => void;
  selected?: boolean;
}) {
  const primary = row.nextActions.find((a) => a.primary);
  const elapsed = Math.floor((Date.now() - anchorMs) / 1000);
  const age = formatAgeSeconds(row.ageSeconds + elapsed);
  const showPayment = role !== "CHEF" && row.payment;

  return (
    <article
      className={`rounded-xl border border-stone-200 bg-white p-3 shadow-sm dark:border-stone-700 dark:bg-stone-900 ${
        flash ? "motion-safe:animate-pulse motion-reduce:ring-2 motion-reduce:ring-brand-400" : ""
      } ${selected ? "ring-2 ring-brand-500" : ""} ${row.isLate ? "border-l-4 border-l-red-500" : ""}`}
      onClick={onOpen}
      onContextMenu={(e) => {
        e.preventDefault();
        onLongPress?.();
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-lg font-bold text-stone-900 dark:text-stone-50">{row.shortDisplay}</p>
          <p className="text-[11px] text-stone-500">
            {typeBadgeShort(row.type)} · {whereLabel(row)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-stone-500">{age}</p>
          {row.isLate && <p className="text-[10px] font-bold uppercase text-red-700">Late</p>}
        </div>
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-stone-600 dark:text-stone-300">
        {row.itemsSummary.lines.map((l) => `${l.quantity}× ${l.name}`).join(", ")}
        {row.itemsSummary.extraCount > 0 ? ` +${row.itemsSummary.extraCount}` : ""}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-brand-700 dark:text-brand-300">{pkr(row.totals.total)}</span>
        {showPayment && (
          <span className="max-w-[55%] truncate text-[10px] font-semibold text-stone-600 dark:text-stone-400">
            {paymentCellLabel(row)}
          </span>
        )}
      </div>
      {primary && (
        <button
          type="button"
          className="btn-primary mt-3 min-h-[44px] w-full text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onAction();
          }}
        >
          {primary.label}
        </button>
      )}
    </article>
  );
}
