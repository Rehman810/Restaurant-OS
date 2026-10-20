"use client";

type Props = {
  offline: boolean;
  offlinePosEnabled: boolean;
  pendingCount: number;
  conflictCount: number;
  onOpenQueue: () => void;
};

export function PosConnectivityBanner({
  offline,
  offlinePosEnabled,
  pendingCount,
  conflictCount,
  onOpenQueue,
}: Props) {
  if (!offlinePosEnabled && !offline && pendingCount === 0 && conflictCount === 0) return null;

  if (offline) {
    return (
      <div
        className="shrink-0 border-b border-stone-600 bg-stone-800 px-3 py-2.5 text-sm text-stone-100 dark:bg-stone-950"
        role="status"
      >
        <p className="font-medium">
          Offline: orders are saved on this device and will sync when you are back online.
        </p>
        {pendingCount > 0 && (
          <button
            type="button"
            onClick={onOpenQueue}
            className="mt-1 font-semibold text-brand-300 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            {pendingCount} order{pendingCount !== 1 ? "s" : ""} pending sync — view queue
          </button>
        )}
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="shrink-0 border-b border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
        <button
          type="button"
          onClick={onOpenQueue}
          className="font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          {pendingCount} order{pendingCount !== 1 ? "s" : ""} pending sync
        </button>
      </div>
    );
  }

  if (conflictCount > 0) {
    return (
      <div className="shrink-0 border-b border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40">
        {conflictCount} sync conflict{conflictCount !== 1 ? "s" : ""} need review (manager).
      </div>
    );
  }

  return null;
}
