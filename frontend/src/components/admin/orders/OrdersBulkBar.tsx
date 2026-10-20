"use client";

export function OrdersBulkBar({
  count,
  onMarkPreparing,
  onPrintKot,
  onAssignRider,
  onCancelStale,
  onClear,
  busy,
}: {
  count: number;
  onMarkPreparing: () => void;
  onPrintKot: () => void;
  onAssignRider: () => void;
  onCancelStale: () => void;
  onClear: () => void;
  busy?: boolean;
}) {
  if (count < 1) return null;

  return (
    <div
      className="sticky bottom-0 z-30 -mx-4 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur-md dark:border-stone-700 dark:bg-stone-900/95 sm:bottom-0"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-stone-900 dark:text-stone-100">{count} selected</span>
        <button
          type="button"
          disabled={busy}
          className="btn-ghost min-h-[44px] text-xs"
          onClick={onMarkPreparing}
        >
          Mark preparing
        </button>
        <button type="button" disabled={busy} className="btn-ghost min-h-[44px] text-xs" onClick={onPrintKot}>
          Print KOT
        </button>
        <button type="button" disabled={busy} className="btn-ghost min-h-[44px] text-xs" onClick={onAssignRider}>
          Assign rider
        </button>
        <button
          type="button"
          disabled={busy}
          className="min-h-[44px] rounded-xl px-3 text-xs font-bold text-red-700 ring-1 ring-red-200 hover:bg-red-50 dark:text-red-300 dark:ring-red-900"
          onClick={onCancelStale}
        >
          Cancel stale
        </button>
        <button type="button" className="ml-auto text-xs font-semibold text-stone-500" onClick={onClear}>
          Clear
        </button>
      </div>
    </div>
  );
}
