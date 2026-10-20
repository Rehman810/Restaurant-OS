"use client";

import { Archive, EyeOff, Percent } from "lucide-react";

type Props = {
  count: number;
  busy?: boolean;
  onClear: () => void;
  onSoldOut: () => void;
  onHide: () => void;
  onArchive: () => void;
  onAdjustPrice: () => void;
};

export function DishBulkBar({ count, busy, onClear, onSoldOut, onHide, onArchive, onAdjustPrice }: Props) {
  if (count === 0) return null;
  return (
    <div
      className="sticky bottom-0 z-30 -mx-4 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-stone-700 dark:bg-stone-900/95 sm:-mx-0 sm:rounded-2xl sm:border"
      role="region"
      aria-label="Bulk actions"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-stone-700 dark:text-stone-200">{count} selected</span>
        <button type="button" onClick={onSoldOut} disabled={busy} className="min-h-11 rounded-xl bg-amber-100 px-3 text-xs font-semibold dark:bg-amber-950/50">
          Sold out
        </button>
        <button type="button" onClick={onHide} disabled={busy} className="min-h-11 rounded-xl bg-stone-100 px-3 text-xs font-semibold dark:bg-stone-800">
          <EyeOff size={14} className="mr-1 inline" aria-hidden /> Hide
        </button>
        <button type="button" onClick={onAdjustPrice} disabled={busy} className="min-h-11 rounded-xl bg-stone-100 px-3 text-xs font-semibold dark:bg-stone-800">
          <Percent size={14} className="mr-1 inline" aria-hidden /> Adjust price
        </button>
        <button type="button" onClick={onArchive} disabled={busy} className="min-h-11 rounded-xl bg-stone-100 px-3 text-xs font-semibold dark:bg-stone-800">
          <Archive size={14} className="mr-1 inline" aria-hidden /> Archive
        </button>
        <button type="button" onClick={onClear} className="ml-auto min-h-11 text-sm font-semibold text-brand-600">
          Clear
        </button>
      </div>
    </div>
  );
}
