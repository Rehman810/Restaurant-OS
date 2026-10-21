"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Building2, MoreVertical, Pencil } from "lucide-react";
import type { AdminBranch } from "@/modules/branches/types";
import { formatMoney, formatStructuredAddress, mapsUrl, openStatusLabel } from "@/lib/branches/helpers";

export function BranchCard({
  branch,
  isAdmin,
  checklistDismissed,
  onDismissChecklist,
  onEdit,
  onDeactivate,
  onReactivate,
  onMakeDefault,
  onToggleOnline,
  onFocusBranch,
  deactivateDisabledReason,
}: {
  branch: AdminBranch;
  isAdmin: boolean;
  checklistDismissed: boolean;
  onDismissChecklist: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
  onMakeDefault: () => void;
  onToggleOnline: () => void;
  onFocusBranch: () => void;
  deactivateDisabledReason?: string | null;
}) {
  const address = formatStructuredAddress(branch);
  const mapLink = mapsUrl(branch.latitude, branch.longitude);
  const statusText = openStatusLabel(branch.open, branch.isActive, branch.acceptsOnlineOrders);
  const cl = branch.setupChecklist;
  const showChecklist = cl && cl.completed < cl.total && !checklistDismissed && branch.isActive;

  return (
    <li className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-stone-900 ${branch.isDefault && branch.isActive ? "border-brand-200 ring-1 ring-brand-100 dark:border-brand-800" : "border-stone-200/80 dark:border-stone-700"} ${!branch.isActive ? "opacity-90" : ""}`}>
      <div className="border-b border-stone-100 px-4 py-3 dark:border-stone-800">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-semibold text-stone-900 dark:text-stone-50">
              <Building2 size={16} className="shrink-0 text-brand-600" aria-hidden />
              <span className="truncate">{branch.name}</span>
              {branch.isDefault && (
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-900 dark:bg-brand-950/50 dark:text-brand-100">
                  Default
                </span>
              )}
            </p>
            <p className="mt-0.5 text-xs font-medium text-stone-600 dark:text-stone-400">Code {branch.code}</p>
          </div>
          {isAdmin && (
            <button type="button" onClick={onEdit} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-stone-200 dark:border-stone-600">
              <Pencil size={16} />
            </button>
          )}
        </div>
        <p className="mt-2 text-xs font-medium text-stone-700 dark:text-stone-300" aria-live="polite">
          <span className="inline-flex rounded-full bg-stone-100 px-2 py-0.5 dark:bg-stone-800">{statusText}</span>
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 py-3 text-sm">
        {address ? (
          <p className="text-stone-600 dark:text-stone-300">
            {address}
            {mapLink && (
              <>
                {" · "}
                <a href={mapLink} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-700 dark:text-brand-300">
                  Open in maps
                </a>
              </>
            )}
          </p>
        ) : (
          <p className="text-stone-400">No address set</p>
        )}
        {branch.managerUser && <p className="text-stone-600 dark:text-stone-300">Manager: {branch.managerUser.name}</p>}

        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4 lg:grid-cols-2">
          <Stat label="Orders today" value={branch.live.ordersToday} />
          <Stat label="Collected" value={formatMoney(branch.live.collectedToday)} />
          <Stat label="In progress" value={branch.live.inProgress} />
          <Stat label="Late" value={branch.live.lateOrders} danger={branch.live.lateOrders > 0} />
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-stone-600 dark:text-stone-400">
          <span>{branch.counts.staff} staff</span>
          <span>·</span>
          <span>{branch.counts.tables} tables</span>
          <span>·</span>
          <span>{branch.counts.printStations} stations</span>
        </div>

        {showChecklist && (
          <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-3 text-xs dark:border-brand-900 dark:bg-brand-950/20">
            <p className="font-semibold text-brand-900 dark:text-brand-100">Setup checklist ({cl.completed}/{cl.total})</p>
            <ul className="mt-1 space-y-0.5 text-stone-700 dark:text-stone-300">
              <Check done={cl.staff}>Add staff</Check>
              <Check done={cl.openingStock}>Receive opening stock</Check>
              <Check done={cl.tables}>Set tables</Check>
              <Check done={cl.printers}>Set printers</Check>
              <Check done={cl.testOrder}>Test order</Check>
            </ul>
            <button type="button" className="mt-2 text-brand-800 underline dark:text-brand-200" onClick={onDismissChecklist}>
              Dismiss
            </button>
          </div>
        )}
      </div>

      <div className="mt-auto flex flex-wrap gap-2 border-t border-stone-100 px-4 py-3 dark:border-stone-800">
        <button type="button" className="btn-primary min-h-[44px] flex-1 sm:flex-none" onClick={() => { onFocusBranch(); window.location.href = "/admin/kitchen"; }}>
          Open kitchen
        </button>
        <button type="button" className="btn-secondary min-h-[44px] flex-1 sm:flex-none" onClick={() => { onFocusBranch(); window.location.href = "/admin/pos"; }}>
          Open POS
        </button>
        <Link href="/admin/settings" onClick={onFocusBranch} className="hidden rounded-xl border px-3 py-2 text-xs font-semibold sm:inline-flex">
          Settings
        </Link>
        {isAdmin && branch.isActive && (
          <>
            {!branch.isDefault && (
              <button type="button" className="rounded-xl border px-3 py-2 text-xs font-semibold" onClick={onMakeDefault}>
                Make default
              </button>
            )}
            <button type="button" className="rounded-xl border px-3 py-2 text-xs font-semibold" onClick={onToggleOnline}>
              Online orders
            </button>
            <button
              type="button"
              disabled={Boolean(deactivateDisabledReason)}
              title={deactivateDisabledReason || undefined}
              className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-800 disabled:opacity-50 dark:border-red-900 dark:text-red-200"
              onClick={onDeactivate}
            >
              Deactivate
            </button>
          </>
        )}
        {isAdmin && !branch.isActive && (
          <button type="button" className="rounded-xl border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 dark:border-emerald-900" onClick={onReactivate}>
            Reactivate
          </button>
        )}
        <Link
          href={`/admin/staff?focusBranch=${branch.id}`}
          onClick={onFocusBranch}
          className="rounded-xl bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-900 dark:bg-brand-950/40 dark:text-brand-100"
        >
          Manage staff
        </Link>
      </div>
    </li>
  );
}

function Stat({ label, value, danger }: { label: string; value: string | number; danger?: boolean }) {
  return (
    <div className="rounded-lg bg-stone-50 px-2 py-2 dark:bg-stone-800/50">
      <p className="text-[11px] font-medium text-stone-500">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${danger ? "text-red-700 dark:text-red-300" : "text-stone-900 dark:text-stone-50"}`}>{value}</p>
    </div>
  );
}

function Check({ done, children }: { done: boolean; children: ReactNode }) {
  return (
    <li className={done ? "text-emerald-700 dark:text-emerald-300" : ""}>
      {done ? "✓ " : "○ "}{children}
    </li>
  );
}
