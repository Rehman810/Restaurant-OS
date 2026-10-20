"use client";

import { useEffect, useRef } from "react";
import { Bike, ChevronDown, MoreHorizontal } from "lucide-react";
import type { AdminOrderRow } from "@/lib/admin-orders/types";
import { formatAgeSeconds } from "@/lib/admin-orders/helpers";
import type { Rider } from "@/lib/admin-types";
import type { Role } from "@/lib/types";

const actionBtn =
  "inline-flex h-10 shrink-0 items-center justify-center rounded-lg text-stone-600 ring-1 ring-stone-200 bg-white hover:bg-stone-50 dark:bg-stone-900 dark:text-stone-300 dark:ring-stone-600";

export function OrdersDispatchCell({
  row,
  riders,
  role,
  anchorMs,
  primary,
  openMenu,
  onToggleMenu,
  onAction,
  onCancel,
  onAssignRider,
}: {
  row: AdminOrderRow;
  riders: Rider[];
  role?: Role;
  anchorMs: number;
  primary?: AdminOrderRow["nextActions"][number];
  openMenu: boolean;
  onToggleMenu: () => void;
  onAction: (action: AdminOrderRow["nextActions"][number]) => void;
  onCancel: () => void;
  onAssignRider: (riderId: string) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenu) return;
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onToggleMenu();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [openMenu, onToggleMenu]);

  const canAssignRider =
    row.type === "DELIVERY" &&
    !row.rider &&
    row.status !== "CANCELLED" &&
    (role === "ADMIN" || role === "MANAGER");

  const secondary = row.nextActions.filter((a) => !a.primary);
  const showMenu = secondary.length > 0;

  return (
    <div className="rounded-xl bg-stone-50/90 p-2 ring-1 ring-stone-200/60 dark:bg-stone-800/50 dark:ring-stone-600/50">
      {row.type === "DELIVERY" && row.rider && (
        <p className="mb-2 flex items-center gap-1.5 truncate rounded-lg bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-900 dark:bg-violet-950/40 dark:text-violet-200">
          <Bike size={13} className="shrink-0" aria-hidden />
          <span className="truncate">{row.rider.name}</span>
          {row.status === "OUT_FOR_DELIVERY" && row.rider.assignedAt && (
            <span className="shrink-0 font-normal text-violet-700/80 dark:text-violet-300/80">
              {formatAgeSeconds(
                row.ageSeconds +
                  Math.floor((anchorMs - new Date(row.statusChangedAt).getTime()) / 1000)
              )}
            </span>
          )}
        </p>
      )}

      {/* Primary + more — one row, same height */}
      <div className="flex items-stretch gap-1.5">
        {primary ? (
          <button
            type="button"
            className="flex h-10 min-w-0 flex-1 items-center justify-center rounded-lg bg-brand-600 px-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            onClick={() => (primary.action === "cancel" ? onCancel() : onAction(primary))}
          >
            <span className="truncate">{primary.label}</span>
          </button>
        ) : (
          <div className="flex h-10 min-w-0 flex-1 items-center justify-center rounded-lg bg-stone-100 text-xs text-stone-500 dark:bg-stone-800">
            No action
          </div>
        )}

        {showMenu && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className={`${actionBtn} w-10`}
              aria-label="More actions"
              aria-expanded={openMenu}
              aria-haspopup="menu"
              onClick={onToggleMenu}
            >
              <MoreHorizontal size={18} />
            </button>
            {openMenu && (
              <div
                className="absolute bottom-full right-0 z-50 mb-1.5 w-48 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-xl dark:border-stone-600 dark:bg-stone-900"
                role="menu"
              >
                {secondary.map((a) => (
                  <button
                    key={`${a.targetStatus}-${a.label}`}
                    type="button"
                    role="menuitem"
                    className="block w-full px-3 py-2.5 text-left text-sm font-medium text-stone-800 hover:bg-stone-50 dark:text-stone-100 dark:hover:bg-stone-800"
                    onClick={() => {
                      onToggleMenu();
                      if (a.action === "cancel") onCancel();
                      else onAction(a);
                    }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {canAssignRider && (
        <div className="relative mt-2 min-w-0">
          <Bike
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 z-[1] -translate-y-1/2 text-stone-400"
            aria-hidden
          />
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-2 top-1/2 z-[1] -translate-y-1/2 text-stone-400"
            aria-hidden
          />
          <select
            className="h-10 w-full appearance-none truncate rounded-lg border-0 bg-white py-0 pl-8 pr-8 text-xs font-semibold text-stone-800 shadow-sm ring-1 ring-stone-200 focus:ring-2 focus:ring-brand-400 dark:bg-stone-900 dark:text-stone-100 dark:ring-stone-600"
            defaultValue=""
            aria-label="Assign rider"
            onChange={(e) => e.target.value && onAssignRider(e.target.value)}
          >
            <option value="">Assign rider</option>
            {riders.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {(r.activeDeliveries ?? 0) > 0 ? ` (${r.activeDeliveries} out)` : ""}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
