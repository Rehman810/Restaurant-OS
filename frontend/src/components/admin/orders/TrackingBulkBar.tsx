"use client";

export function TrackingBulkBar({
  count,
  busy,
  onAssignRider,
  onClear,
}: {
  count: number;
  busy?: boolean;
  onAssignRider: () => void;
  onClear: () => void;
}) {
  if (count < 1) return null;

  return (
    <div
      className="sticky bottom-0 z-30 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur-md dark:border-stone-700 dark:bg-stone-900/95"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-stone-900 dark:text-stone-100">{count} selected</span>
        <button
          type="button"
          disabled={busy}
          className="btn-primary min-h-[44px] text-xs"
          onClick={onAssignRider}
        >
          Assign rider
        </button>
        <button type="button" className="ml-auto text-xs font-semibold text-stone-500" onClick={onClear}>
          Clear
        </button>
      </div>
    </div>
  );
}
