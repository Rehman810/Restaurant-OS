"use client";

import { SlidersHorizontal, X } from "lucide-react";
import type { FulfillmentType } from "@/lib/types";
import type { Rider } from "@/lib/admin-types";

export function TrackingFilterSheet({
  open,
  onOpen,
  onClose,
  typeParam,
  lateOnly,
  riderId,
  riders,
  onType,
  onLateOnly,
  onRider,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  typeParam: FulfillmentType | "ALL";
  lateOnly: boolean;
  riderId: string;
  riders: Rider[];
  onType: (t: FulfillmentType | "ALL") => void;
  onLateOnly: (v: boolean) => void;
  onRider: (id: string) => void;
}) {
  const activeCount =
    (typeParam !== "ALL" ? 1 : 0) + (lateOnly ? 1 : 0) + (riderId ? 1 : 0);

  return (
    <>
      <button
        type="button"
        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold text-stone-800 ring-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100 lg:hidden"
        onClick={onOpen}
        aria-expanded={open}
        aria-controls="tracking-mobile-filters"
      >
        <SlidersHorizontal size={16} aria-hidden />
        Filters{activeCount > 0 ? ` (${activeCount})` : ""}
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] lg:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-stone-950/50"
            aria-label="Close filters"
            onClick={onClose}
          />
          <div
            id="tracking-mobile-filters"
            role="dialog"
            aria-modal="true"
            aria-label="Board filters"
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-50">Filters</h2>
              <button
                type="button"
                aria-label="Close"
                className="grid h-11 w-11 place-items-center rounded-full border border-stone-200 focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-stone-600"
                onClick={onClose}
              >
                <X size={18} />
              </button>
            </div>

            <p className="mb-2 text-xs font-bold uppercase text-stone-500">Type</p>
            <div className="mb-4 flex flex-wrap gap-2">
              {(["ALL", "DELIVERY", "PICKUP", "DINE_IN"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`min-h-[44px] rounded-full px-3 py-2 text-xs font-bold ring-1 focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    typeParam === t
                      ? "bg-brand-50 text-brand-900 ring-brand-200"
                      : "bg-stone-50 text-stone-700 ring-stone-200"
                  }`}
                  onClick={() => onType(t)}
                >
                  {t === "ALL" ? "All" : t.replace("_", " ")}
                </button>
              ))}
            </div>

            <label className="mb-4 flex min-h-[44px] cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-stone-300 text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500"
                checked={lateOnly}
                onChange={(e) => onLateOnly(e.target.checked)}
              />
              <span className="text-sm font-semibold text-stone-800 dark:text-stone-100">Late only</span>
            </label>

            <p className="mb-2 text-xs font-bold uppercase text-stone-500">Rider</p>
            <select
              className="input mb-2 min-h-[44px] w-full"
              value={riderId}
              onChange={(e) => onRider(e.target.value)}
              aria-label="Filter by rider"
            >
              <option value="">All riders</option>
              {riders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.activeDeliveries != null ? ` (${r.activeDeliveries} active)` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </>
  );
}
