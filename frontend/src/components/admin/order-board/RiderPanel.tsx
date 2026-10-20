"use client";

import { Bike, Package } from "lucide-react";
import type { TrackingRider } from "@/lib/admin-orders/tracking";
import { formatAgeCompact } from "@/lib/admin-orders/helpers";
import { pkr } from "@/lib/format";

export function RiderPanel({
  riders,
  canAssign,
  onOpenOrder,
  onAssignDelivery,
  onSelectRider,
}: {
  riders: TrackingRider[];
  canAssign: boolean;
  onOpenOrder: (orderId: string) => void;
  onAssignDelivery: (riderId: string) => void;
  onSelectRider?: (riderId: string) => void;
}) {
  if (!riders.length) {
    return (
      <p className="rounded-xl border border-dashed border-stone-200 px-4 py-8 text-center text-sm text-stone-500 dark:border-stone-700">
        No active riders in this branch.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {riders.map((rider) => (
        <article
          key={rider.id}
          className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm dark:border-stone-700 dark:bg-stone-900"
        >
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              className="min-h-[44px] text-left"
              onClick={() => onSelectRider?.(rider.id)}
            >
              <p className="flex items-center gap-1.5 font-semibold text-stone-900 dark:text-stone-50">
                <Bike size={16} className="text-brand-600 dark:text-brand-400" aria-hidden />
                {rider.name}
              </p>
              <p className="mt-0.5 text-xs text-stone-500">
                {rider.status === "on_delivery" ? "On delivery" : "Available"}
                {rider.longestOutSinceSeconds != null && rider.longestOutSinceSeconds > 0 && (
                  <span> · Out {formatAgeCompact(rider.longestOutSinceSeconds)}</span>
                )}
              </p>
            </button>
            {rider.codCashHeld > 0 && (
              <span className="shrink-0 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-900 ring-1 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-200">
                COD {pkr(rider.codCashHeld)}
              </span>
            )}
          </div>

          {rider.activeDeliveries.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {rider.activeDeliveries.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    className="min-h-[36px] rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-bold text-stone-800 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-100"
                    onClick={() => onOpenOrder(d.id)}
                  >
                    {d.shortDisplay}
                    {d.outSinceSeconds > 0 && (
                      <span className="ml-1 font-medium text-stone-500">
                        {formatAgeCompact(d.outSinceSeconds)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {canAssign && (
            <button
              type="button"
              className="btn-secondary mt-2 min-h-[44px] w-full text-xs"
              onClick={() => onAssignDelivery(rider.id)}
            >
              <Package size={14} className="mr-1 inline" aria-hidden />
              Assign delivery
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
