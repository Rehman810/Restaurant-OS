"use client";

import { AlertTriangle, Clock, Copy, MapPin, Phone } from "lucide-react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type { AdminOrderRow } from "@/lib/admin-orders/types";
import {
  formatAgeSeconds,
  formatStoreTime12h,
  normalizeAddressDisplay,
  paymentCellLabel,
  pluralizeItems,
} from "@/lib/admin-orders/helpers";
import { deriveShortOrderNumber } from "@/lib/kitchen/helpers";
import { pkr } from "@/lib/format";
import { OrdersDispatchCell } from "./OrdersDispatchCell";
import type { Rider } from "@/lib/admin-types";
import type { Role } from "@/lib/types";

function copyText(text: string) {
  void navigator.clipboard?.writeText(text);
}

export function ordersDispatchGridCols(showPayment: boolean) {
  if (showPayment) {
    return "lg:grid-cols-[2.25rem_minmax(0,1.05fr)_minmax(0,0.95fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,4.75rem)_minmax(0,5.5rem)_minmax(11.5rem,13rem)]";
  }
  return "lg:grid-cols-[2.25rem_minmax(0,1.05fr)_minmax(0,0.95fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,5.5rem)_minmax(11.5rem,13rem)]";
}

export function OrdersDispatchRow({
  row,
  riders,
  timeZone,
  anchorMs,
  role,
  showPayment,
  flash,
  selected,
  primary,
  openMenu,
  onToggleMenu,
  onSelect,
  onToggleSelect,
  onAction,
  onCancel,
  onAssignRider,
  onOpenDuplicate,
}: {
  row: AdminOrderRow;
  riders: Rider[];
  timeZone: string;
  anchorMs: number;
  role?: Role;
  showPayment: boolean;
  flash: boolean;
  selected?: boolean;
  primary?: AdminOrderRow["nextActions"][number];
  openMenu: boolean;
  onToggleMenu: () => void;
  onSelect: () => void;
  onToggleSelect?: () => void;
  onAction: (action: AdminOrderRow["nextActions"][number]) => void;
  onCancel: () => void;
  onAssignRider: (riderId: string) => void;
  onOpenDuplicate?: (id: string) => void;
}) {
  const { display: shortNo } = deriveShortOrderNumber(row.number);
  const elapsed = Math.floor((Date.now() - anchorMs) / 1000);
  const ageLabel = formatAgeSeconds(row.ageSeconds + elapsed);
  const ageTitle = formatStoreTime12h(row.statusChangedAt, timeZone);
  const typeLabel =
    row.type === "DELIVERY" ? "Delivery" : row.type === "PICKUP" ? "Takeaway" : "Dine-in";

  const itemPreview = row.itemsSummary.lines
    .slice(0, 2)
    .map((l) => `${l.quantity}× ${l.name}`)
    .join(" · ");

  const rowSurface = row.isLate
    ? "border-red-200/80 bg-gradient-to-r from-red-50/80 via-white to-white dark:from-red-950/25 dark:via-stone-900 dark:to-stone-900"
    : row.isStale
      ? "border-amber-200/80 bg-gradient-to-r from-amber-50/60 via-white to-white dark:from-amber-950/20 dark:via-stone-900 dark:to-stone-900"
      : "border-stone-200/70 bg-white dark:border-stone-700 dark:bg-stone-900";

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`group relative grid grid-cols-1 gap-3 rounded-2xl border p-4 shadow-sm transition hover:border-brand-200/80 hover:shadow-md dark:hover:border-brand-800/50 ${ordersDispatchGridCols(showPayment)} lg:items-center lg:gap-x-4 lg:py-3.5 ${rowSurface} ${
        flash ? "motion-safe:animate-pulse motion-reduce:ring-2 motion-reduce:ring-brand-400" : ""
      } ${selected ? "ring-2 ring-brand-400 ring-offset-2 dark:ring-offset-stone-950" : ""}`}
    >
      {row.isLate && (
        <span
          className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-red-500 lg:top-2 lg:bottom-2"
          aria-hidden
        />
      )}

      {onToggleSelect && (
        <div className="hidden lg:flex lg:items-center lg:justify-center" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
            checked={selected ?? false}
            aria-label={`Select order ${row.shortDisplay}`}
            onChange={onToggleSelect}
          />
        </div>
      )}

      {/* Order */}
      <div className="min-w-0 pl-1 lg:pl-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
            {row.shortDisplay || shortNo}
          </span>
          {row.isLate && (
            <span className="rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              Late
            </span>
          )}
          {row.isStale && !row.isLate && (
            <span className="rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              Stale
            </span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <StatusBadge status={row.status} fulfillmentType={row.type} />
          <span className="text-xs text-stone-500" title={`In status since ${ageTitle}`}>
            <Clock size={11} className="mr-0.5 inline opacity-70" aria-hidden />
            {typeLabel} · {ageLabel}
          </span>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-stone-400 opacity-0 transition hover:bg-stone-100 hover:text-stone-600 group-hover:opacity-100 dark:hover:bg-stone-800"
            aria-label="Copy full order number"
            onClick={(e) => {
              e.stopPropagation();
              copyText(row.number);
            }}
          >
            <Copy size={13} />
          </button>
        </div>
        {row.possibleDuplicateOf && (
          <button
            type="button"
            className="mt-1 text-xs font-semibold text-amber-700 underline-offset-2 hover:underline dark:text-amber-300"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDuplicate?.(row.possibleDuplicateOf!);
            }}
          >
            Possible duplicate
          </button>
        )}
      </div>

      {/* Customer */}
      <div className="min-w-0 border-t border-stone-100 pt-3 lg:border-0 lg:pt-0 dark:border-stone-800">
        <p className="truncate font-semibold text-stone-900 dark:text-stone-100">{row.customer.name}</p>
        {!row.customer.phoneMasked ? (
          <a
            href={`tel:${row.customer.phone}`}
            className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-brand-700 dark:text-stone-400"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300">
              <Phone size={14} aria-hidden />
            </span>
            <span className="font-medium">{row.customer.phone}</span>
          </a>
        ) : (
          <p className="mt-0.5 text-sm text-stone-500">{row.customer.phone}</p>
        )}
      </div>

      {/* Items */}
      <div className="min-w-0 border-t border-stone-100 pt-3 lg:border-0 lg:pt-0 dark:border-stone-800">
        <p className="line-clamp-2 text-sm leading-snug text-stone-700 dark:text-stone-300">
          {itemPreview || "—"}
          {row.itemsSummary.extraCount > 0 && (
            <span className="font-semibold text-stone-500"> · +{row.itemsSummary.extraCount} more</span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-stone-400">{pluralizeItems(row.itemsSummary.totalItems)}</p>
      </div>

      {/* Where */}
      <div
        className="min-w-0 border-t border-stone-100 pt-3 lg:border-0 lg:pt-0 dark:border-stone-800"
        onClick={(e) => e.stopPropagation()}
      >
        {row.type === "DELIVERY" && row.address && (
          <>
            <p className="line-clamp-2 text-sm leading-snug text-stone-600 dark:text-stone-400">
              {normalizeAddressDisplay(row.address.text)}
            </p>
            <div className="mt-1.5 flex gap-1">
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-stone-100 px-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-200"
                onClick={() => copyText(row.address!.text)}
              >
                <Copy size={12} /> Copy
              </button>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(row.address.text)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-brand-50 px-2.5 text-xs font-semibold text-brand-800 hover:bg-brand-100 dark:bg-brand-950/50 dark:text-brand-200"
              >
                <MapPin size={12} /> Maps
              </a>
            </div>
          </>
        )}
        {row.type === "DINE_IN" &&
          (row.table ? (
            <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">Table {row.table}</p>
          ) : (
            <p className="flex items-center gap-1 text-sm font-medium text-amber-800 dark:text-amber-200">
              <AlertTriangle size={14} /> Assign table in POS
            </p>
          ))}
        {row.type === "PICKUP" && (
          <p className="text-sm font-medium text-stone-600 dark:text-stone-400">Customer pickup</p>
        )}
      </div>

      {/* Payment — desktop column */}
      {showPayment && (
        <div className="hidden lg:block">
          <PaymentPill row={row} />
        </div>
      )}

      {/* Total */}
      <div className="flex items-center justify-between border-t border-stone-100 pt-3 lg:block lg:border-0 lg:pt-0 lg:text-right dark:border-stone-800">
        <span className="text-xs font-semibold uppercase tracking-wide text-stone-400 lg:hidden">Total</span>
        <p className="font-display text-xl font-bold tabular-nums text-stone-900 dark:text-stone-50">
          {pkr(row.totals.total)}
        </p>
        {showPayment && (
          <div className="lg:hidden">
            <PaymentPill row={row} />
          </div>
        )}
      </div>

      {/* Dispatch */}
      <div className="border-t border-stone-100 pt-3 lg:border-0 lg:pt-0 dark:border-stone-800" onClick={(e) => e.stopPropagation()}>
        <OrdersDispatchCell
          row={row}
          riders={riders}
          role={role}
          anchorMs={anchorMs}
          primary={primary}
          openMenu={openMenu}
          onToggleMenu={onToggleMenu}
          onAction={onAction}
          onCancel={onCancel}
          onAssignRider={onAssignRider}
        />
      </div>
    </article>
  );
}

function PaymentPill({ row }: { row: AdminOrderRow }) {
  const paid = row.payment?.status === "paid";
  const partial = row.payment?.status === "partial";
  return (
    <span
      className={`inline-flex max-w-full rounded-lg px-2 py-1 text-[11px] font-bold leading-tight ${
        paid
          ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-200"
          : partial
            ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
            : "bg-stone-100 text-stone-700 ring-1 ring-stone-200 dark:bg-stone-800 dark:text-stone-300"
      }`}
    >
      {paymentCellLabel(row)}
    </span>
  );
}

export function OrdersDispatchListHeader({ showPayment, onToggleSelectAll, allSelected }: {
  showPayment: boolean;
  onToggleSelectAll?: () => void;
  allSelected?: boolean;
}) {
  return (
    <div
      className={`hidden gap-x-4 px-4 pb-2 text-[10px] font-semibold uppercase tracking-wider text-stone-400 lg:grid ${ordersDispatchGridCols(showPayment)}`}
    >
      {onToggleSelectAll ? (
        <div className="flex justify-center">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-stone-300"
            checked={allSelected}
            aria-label="Select all on page"
            onChange={onToggleSelectAll}
          />
        </div>
      ) : (
        <span />
      )}
      <span>Order</span>
      <span>Customer</span>
      <span>Items</span>
      <span>Location</span>
      {showPayment && <span>Payment</span>}
      <span className="text-right">Total</span>
      <span>Next step</span>
    </div>
  );
}
