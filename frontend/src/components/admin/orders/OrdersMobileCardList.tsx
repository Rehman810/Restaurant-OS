"use client";

import { Phone } from "lucide-react";
import type { AdminOrderRow } from "@/lib/admin-orders/types";
import { formatAgeSeconds, paymentCellLabel } from "@/lib/admin-orders/helpers";
import { typeBadgeShort } from "@/lib/admin-orders/board-columns";
import { pkr } from "@/lib/format";
import type { Role } from "@/lib/types";
import { useLongPress } from "@/hooks/useLongPress";

function MobileOrderCard({
  row,
  anchorMs,
  role,
  flash,
  selected,
  onOpen,
  onAction,
  onLongPress,
}: {
  row: AdminOrderRow;
  anchorMs: number;
  role?: Role;
  flash?: boolean;
  selected?: boolean;
  onOpen: () => void;
  onAction: () => void;
  onLongPress: () => void;
}) {
  const press = useLongPress({ onClick: onOpen, onLongPress, delayMs: 500 });
  const elapsed = Math.floor((Date.now() - anchorMs) / 1000);
  const age = formatAgeSeconds(row.ageSeconds + elapsed);
  const primary = row.nextActions.find((a) => a.primary);
  const showPayment = role !== "CHEF" && row.payment;

  return (
    <article
      className={`rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-900 ${
        flash ? "motion-safe:animate-pulse motion-reduce:ring-2 motion-reduce:ring-brand-400" : ""
      } ${selected ? "ring-2 ring-brand-500" : ""}`}
      {...press.handlers}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-2xl font-bold text-stone-900 dark:text-stone-50">{row.shortDisplay}</p>
          <p className="text-xs font-semibold text-stone-500">
            {typeBadgeShort(row.type)} · {age}
            {row.isLate && <span className="ml-1 font-bold uppercase text-red-700"> · late</span>}
          </p>
        </div>
        <p className="font-display text-lg font-bold text-brand-700">{pkr(row.totals.total)}</p>
      </div>
      <p className="mt-2 font-semibold text-stone-900 dark:text-stone-100">{row.customer.name}</p>
      {!row.customer.phoneMasked && (
        <a
          href={`tel:${row.customer.phone}`}
          className="mt-1 inline-flex min-h-[44px] items-center gap-1 text-sm font-bold text-stone-800 dark:text-stone-200"
          onClick={(e) => e.stopPropagation()}
        >
          <Phone size={14} /> {row.customer.phone}
        </a>
      )}
      {showPayment && (
        <p className="mt-2 text-xs font-bold text-stone-600 dark:text-stone-400">{paymentCellLabel(row)}</p>
      )}
      {primary && (
        <button
          type="button"
          className="btn-primary mt-3 min-h-[48px] w-full"
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

export function OrdersMobileCardList({
  rows,
  serverTime,
  role,
  flashIds,
  selectedIds,
  onOpen,
  onAction,
  onLongPress,
}: {
  rows: AdminOrderRow[];
  serverTime: string;
  role?: Role;
  flashIds: Set<string>;
  selectedIds?: Set<string>;
  onOpen: (row: AdminOrderRow) => void;
  onAction: (row: AdminOrderRow, action: AdminOrderRow["nextActions"][number]) => void;
  onLongPress: (row: AdminOrderRow) => void;
}) {
  const anchorMs = new Date(serverTime).getTime();

  return (
    <div
      className="flex flex-col gap-3 pb-24 lg:hidden"
      style={{ paddingBottom: "max(6rem, calc(6rem + env(safe-area-inset-bottom)))" }}
    >
      {rows.map((row) => {
        const primary = row.nextActions.find((a) => a.primary);
        return (
          <MobileOrderCard
            key={row.id}
            row={row}
            anchorMs={anchorMs}
            role={role}
            flash={flashIds.has(row.id)}
            selected={selectedIds?.has(row.id)}
            onOpen={() => onOpen(row)}
            onAction={() => primary && onAction(row, primary)}
            onLongPress={() => onLongPress(row)}
          />
        );
      })}
    </div>
  );
}
