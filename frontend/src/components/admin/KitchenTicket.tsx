"use client";

import { ArrowRight, ChefHat, Check, Package, Printer, StickyNote } from "lucide-react";
import { FulfillmentBadge } from "@/components/FulfillmentBadge";
import { STATUS_THEME } from "@/lib/admin-status";
import { formatElapsed } from "@/lib/format";
import { Order } from "@/lib/types";

export function KitchenTicket({
  order,
  actionLabel,
  onAction,
  onPrint,
  printBusy,
  busy,
  error,
}: {
  order: Order;
  actionLabel?: string;
  onAction?: () => void;
  onPrint?: () => void;
  printBusy?: boolean;
  busy?: boolean;
  error?: string;
}) {
  const theme = STATUS_THEME[order.status];
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);

  return (
    <article className={`relative shrink-0 overflow-hidden rounded-xl border bg-white shadow-sm ${theme.border}`}>
      <div className={`absolute left-0 top-0 h-full w-1 ${theme.stripe}`} />

      <div className="p-3 pl-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-stone-900">{order.orderNumber}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <FulfillmentBadge type={order.fulfillmentType} />
              {order.orderSource === "POS" && (
                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-800 ring-1 ring-violet-100">
                  POS
                </span>
              )}
              {order.tableNumber && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 ring-1 ring-emerald-100">
                  T{order.tableNumber}
                </span>
              )}
            </div>
          </div>
          <p className="inline-flex shrink-0 items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
            <span className={`h-1.5 w-1.5 rounded-full ${theme.dot}`} />
            {formatElapsed(order.createdAt)}
          </p>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-stone-600">
          <Package size={12} className="shrink-0 text-stone-400" />
          <span className="font-medium text-stone-800">{order.customerName || "Guest"}</span>
          <span className="text-stone-300">·</span>
          <span className="shrink-0 text-stone-500">{itemCount} item{itemCount === 1 ? "" : "s"}</span>
        </div>

        {order.items.length > 0 ? (
          <ul className="mt-2.5 space-y-1.5 rounded-lg bg-stone-50 px-2.5 py-2 ring-1 ring-stone-100">
            {order.items.map((item) => (
              <li key={item.id} className="text-xs leading-snug text-stone-700">
                <span className="font-semibold text-stone-900">{item.quantity}×</span> {item.nameAtOrder}
                {item.optionsLabel ? <span className="text-stone-500"> · {item.optionsLabel}</span> : null}
                {item.instructions ? (
                  <span className="mt-0.5 block text-[11px] italic text-stone-500">{item.instructions}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2.5 text-xs text-stone-400">No line items loaded</p>
        )}

        {order.notes && (
          <p className="mt-2 flex gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900 ring-1 ring-amber-100">
            <StickyNote size={12} className="mt-0.5 shrink-0 text-amber-600" />
            {order.notes}
          </p>
        )}

        {error && <p className="mt-2 text-[11px] font-medium text-rose-600">{error}</p>}

        <div className="mt-3 flex gap-2">
          {onPrint && (
            <button
              type="button"
              disabled={printBusy || busy}
              onClick={onPrint}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-60"
            >
              <Printer size={13} />
              {printBusy ? "Printing…" : "Print KOT"}
            </button>
          )}
          {onAction && actionLabel ? (
            <button
              type="button"
              disabled={busy || printBusy}
              onClick={onAction}
              className="inline-flex flex-[2] items-center justify-center gap-1.5 rounded-lg bg-stone-900 py-2 text-xs font-medium text-white transition hover:bg-brand-600 disabled:opacity-60"
            >
              {order.status === "CONFIRMED" ? <ChefHat size={13} /> : <Check size={13} />}
              {busy ? "Updating…" : actionLabel}
              <ArrowRight size={13} />
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
