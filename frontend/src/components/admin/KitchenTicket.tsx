"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Ban,
  ChefHat,
  Check,
  Circle,
  Flame,
  Printer,
  StickyNote,
  Timer,
} from "lucide-react";
import { fulfillmentLabel } from "@/components/FulfillmentBadge";
import { STATUS_THEME } from "@/lib/admin-status";
import type { KitchenRejectReason } from "@/lib/admin-kitchen";
import {
  collectItemSafetyLines,
  deriveShortOrderNumber,
  dineInTableLabel,
  elapsedMinutes,
  formatKitchenElapsed,
  formatKotPrintStatus,
  formatPromisedTime,
  isKitchenOrderStale,
  isPromisedLate,
  KITCHEN_READY_COLD_MINUTES,
  kitchenTicketTimerIso,
  kitchenTimerClass,
  kitchenTimerTone,
} from "@/lib/kitchen/helpers";
import { FulfillmentType, Order } from "@/lib/types";

function KitchenElapsed({
  iso,
  label,
  coldAlert,
}: {
  iso: string;
  label?: string;
  coldAlert?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const mins = elapsedMinutes(iso, now);
  const tone = kitchenTimerTone(mins);
  const text = formatKitchenElapsed(iso, now);

  return (
    <div className="flex flex-col items-end gap-0.5">
      {label ? <span className="text-[10px] font-medium uppercase tracking-wide text-stone-400">{label}</span> : null}
      <p
        className={`inline-flex items-center gap-1 rounded-lg bg-stone-100 px-2.5 py-1 text-base font-bold tabular-nums dark:bg-stone-800 ${kitchenTimerClass(tone)}`}
      >
        <Timer size={14} className="shrink-0 opacity-80" />
        {text}
      </p>
      {coldAlert && mins >= KITCHEN_READY_COLD_MINUTES ? (
        <span className="rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-red-800 ring-1 ring-red-200 dark:bg-red-950/60 dark:text-red-200 dark:ring-red-800">
          Getting cold
        </span>
      ) : null}
    </div>
  );
}

function TypeBadge({ type }: { type?: FulfillmentType | null }) {
  const label = fulfillmentLabel(type);
  const styles =
    type === "PICKUP"
      ? "bg-stone-200 text-stone-900 ring-stone-300 dark:bg-stone-700 dark:text-stone-100 dark:ring-stone-600"
      : type === "DINE_IN"
        ? "bg-emerald-200 text-emerald-950 ring-emerald-300 dark:bg-emerald-900 dark:text-emerald-100 dark:ring-emerald-700"
        : "bg-brand-200 text-brand-950 ring-brand-300 dark:bg-brand-900 dark:text-brand-100 dark:ring-brand-700";

  return (
    <span className={`inline-flex rounded-lg px-3 py-1.5 text-sm font-bold uppercase tracking-wide ring-1 ${styles}`}>
      {label}
    </span>
  );
}

export function KitchenTicket({
  order,
  actionLabel,
  onAction,
  onPrint,
  onToggleRush,
  onItemDone,
  onItemStock,
  onReject,
  printBusy,
  busy,
  error,
  pulse,
  onAcknowledge,
}: {
  order: Order;
  actionLabel?: string;
  onAction?: () => void;
  onPrint?: () => void;
  onToggleRush?: () => void;
  onItemDone?: (itemId: string, done: boolean) => void;
  onItemStock?: (menuItemId: string, available: boolean) => void;
  onReject?: (body: {
    scope: "order" | "item";
    reasonCode: KitchenRejectReason;
    reasonNote?: string;
    itemId?: string;
  }) => void;
  printBusy?: boolean;
  busy?: boolean;
  error?: string;
  pulse?: boolean;
  onAcknowledge?: () => void;
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectScope, setRejectScope] = useState<"order" | "item">("order");
  const [rejectItemId, setRejectItemId] = useState("");
  const [rejectReason, setRejectReason] = useState<KitchenRejectReason>("OUT_OF_STOCK");
  const [rejectNote, setRejectNote] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const theme = STATUS_THEME[order.status];
  const { display: shortNo, full: fullNo } = deriveShortOrderNumber(order.orderNumber);
  const tableLabel = dineInTableLabel(order);
  const isReady = order.status === "READY";
  const timerIso = kitchenTicketTimerIso(order);
  const stale = isKitchenOrderStale(order, now);
  const canCheckItems = order.status === "CONFIRMED" || order.status === "PREPARING";
  const kotLabel = formatKotPrintStatus(order);
  const promisedLate = order.promisedAt ? isPromisedLate(order.promisedAt, now) : false;

  function submitReject() {
    if (!onReject) return;
    onReject({
      scope: rejectScope,
      reasonCode: rejectReason,
      reasonNote: rejectNote.trim() || undefined,
      itemId: rejectScope === "item" ? rejectItemId : undefined,
    });
    setRejectOpen(false);
    setRejectNote("");
  }

  return (
    <article
      onClick={() => onAcknowledge?.()}
      className={`kds-ticket relative shrink-0 overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-stone-900 ${theme.border} ${
        order.isRush ? "ring-2 ring-orange-400 dark:ring-orange-500" : ""
      } ${
        pulse
          ? "animate-pulse ring-2 ring-amber-400 ring-offset-2 ring-offset-stone-50 dark:ring-amber-500 dark:ring-offset-stone-950"
          : ""
      }`}
    >
      <div className={`absolute left-0 top-0 h-full w-1.5 ${theme.stripe}`} />

      <div className="p-4 pl-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <TypeBadge type={order.fulfillmentType} />
              {order.isRush ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-orange-100 px-2 py-1 text-xs font-bold uppercase text-orange-900 dark:bg-orange-950 dark:text-orange-200">
                  <Flame size={12} /> Rush
                </span>
              ) : null}
              {stale ? (
                <span className="rounded-lg bg-violet-100 px-2 py-1 text-xs font-bold text-violet-900 dark:bg-violet-950 dark:text-violet-200">
                  Stale — confirm or cancel
                </span>
              ) : null}
            </div>
            {tableLabel ? (
              <p className="font-display text-2xl font-bold leading-tight text-stone-900 dark:text-stone-50">
                {tableLabel}
              </p>
            ) : null}
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="font-display text-3xl font-bold tabular-nums text-stone-900 dark:text-stone-50">{shortNo}</p>
              <p className="truncate text-xs text-stone-400 dark:text-stone-500">{fullNo}</p>
            </div>
            <p className="text-sm text-stone-500 dark:text-stone-400">{order.customerName || "Guest"}</p>
            {order.promisedAt ? (
              <p
                className={`text-sm font-bold ${promisedLate ? "text-red-600 dark:text-red-400" : "text-stone-600 dark:text-stone-300"}`}
              >
                Promised {formatPromisedTime(order.promisedAt)}
                {promisedLate ? " · Late" : ""}
              </p>
            ) : null}
            <p className="text-xs text-stone-400 dark:text-stone-500">{kotLabel}</p>
          </div>
          <KitchenElapsed iso={timerIso} label={isReady ? "Ready" : "Waiting"} coldAlert={isReady} />
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {onToggleRush ? (
            <button
              type="button"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                onToggleRush();
              }}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ring-1 ${
                order.isRush
                  ? "bg-orange-100 text-orange-900 ring-orange-200 dark:bg-orange-950 dark:text-orange-200"
                  : "bg-stone-100 text-stone-700 ring-stone-200 dark:bg-stone-800 dark:text-stone-200"
              }`}
            >
              {order.isRush ? "Unrush" : "Rush"}
            </button>
          ) : null}
          {onReject ? (
            <button
              type="button"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                setRejectOpen((v) => !v);
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-2.5 py-1.5 text-xs font-bold text-stone-700 ring-1 ring-stone-200 dark:bg-stone-800 dark:text-stone-200 dark:ring-stone-600"
            >
              <Ban size={12} /> Reject
            </button>
          ) : null}
        </div>

        {rejectOpen && onReject ? (
          <div
            className="mt-2 space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-3 dark:border-stone-700 dark:bg-stone-800/80"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-2">
              {(["order", "item"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRejectScope(s)}
                  className={`rounded-md px-2 py-1 text-xs font-bold ${rejectScope === s ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900" : "text-stone-500"}`}
                >
                  {s === "order" ? "Whole order" : "One item"}
                </button>
              ))}
            </div>
            {rejectScope === "item" ? (
              <select
                className="input w-full text-sm"
                value={rejectItemId}
                onChange={(e) => setRejectItemId(e.target.value)}
              >
                <option value="">Select item…</option>
                {order.items.map((i) => (
                  <option key={i.id} value={i.id}>{i.nameAtOrder}</option>
                ))}
              </select>
            ) : null}
            <select
              className="input w-full text-sm"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value as KitchenRejectReason)}
            >
              <option value="OUT_OF_STOCK">Out of stock</option>
              <option value="EQUIPMENT">Equipment issue</option>
              <option value="OTHER">Other</option>
            </select>
            {rejectReason === "OTHER" ? (
              <input
                className="input w-full text-sm"
                placeholder="Reason (required)"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
              />
            ) : null}
            <button type="button" onClick={submitReject} className="btn-primary w-full text-sm">
              Send to counter
            </button>
          </div>
        ) : null}

        {order.items.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {order.items.map((item) => {
              const safety = collectItemSafetyLines(item);
              const done = Boolean(item.kitchenDoneAt);
              const unavailable = item.menuItem?.isAvailable === false;
              return (
                <li key={item.id} className="border-b border-stone-100 pb-3 last:border-0 last:pb-0 dark:border-stone-800">
                  <div className="flex items-start gap-3">
                    {canCheckItems && onItemDone ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation();
                          onItemDone(item.id, !done);
                        }}
                        className={`mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg ring-1 ${
                          done
                            ? "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-200"
                            : "bg-stone-100 text-stone-500 ring-stone-200 dark:bg-stone-800"
                        }`}
                        aria-label={done ? "Mark not done" : "Mark done"}
                      >
                        {done ? <Check size={18} /> : <Circle size={18} />}
                      </button>
                    ) : null}
                    <span className="shrink-0 font-display text-2xl font-bold tabular-nums text-stone-900 dark:text-stone-50">
                      {item.quantity}×
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-lg font-bold leading-snug ${done ? "text-stone-400 line-through dark:text-stone-500" : "text-stone-900 dark:text-stone-50"}`}
                      >
                        {item.nameAtOrder}
                      </p>
                      {unavailable ? (
                        <p className="mt-1 text-xs font-bold text-amber-700 dark:text-amber-300">86 — off menu</p>
                      ) : null}
                      {onItemStock ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            onItemStock(item.menuItemId, unavailable);
                          }}
                          className="mt-1 text-xs font-bold text-stone-500 underline dark:text-stone-400"
                        >
                          {unavailable ? "Restore item" : "86 item"}
                        </button>
                      ) : null}
                      {safety.length > 0 ? (
                        <div className="mt-2 space-y-1">
                          {safety.map((line) => (
                            <p
                              key={line}
                              className="rounded-lg bg-red-100 px-2.5 py-2 text-base font-bold leading-snug text-red-900 ring-1 ring-red-200 dark:bg-red-950/70 dark:text-red-100 dark:ring-red-800"
                            >
                              {line}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-stone-400">No line items loaded</p>
        )}

        {order.notes?.trim() ? (
          <p className="mt-3 flex gap-2 rounded-lg bg-red-100 px-3 py-2.5 text-base font-bold leading-snug text-red-900 ring-1 ring-red-200 dark:bg-red-950/70 dark:text-red-100 dark:ring-red-800">
            <StickyNote size={18} className="mt-0.5 shrink-0" />
            {order.notes.trim()}
          </p>
        ) : null}

        {error ? <p className="mt-2 text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p> : null}

        <div className="mt-4 flex gap-2">
          {onPrint ? (
            <button
              type="button"
              disabled={printBusy || busy}
              onClick={(e) => {
                e.stopPropagation();
                onPrint?.();
              }}
              className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-60 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
            >
              <Printer size={16} />
              {printBusy ? "Printing…" : "Print KOT"}
            </button>
          ) : null}
          {onAction && actionLabel ? (
            <button
              type="button"
              disabled={busy || printBusy}
              onClick={(e) => {
                e.stopPropagation();
                onAction?.();
              }}
              className="inline-flex min-h-[48px] flex-[2] items-center justify-center gap-2 rounded-xl bg-stone-900 py-3 text-base font-bold text-white transition hover:bg-brand-600 disabled:opacity-60 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-brand-500"
            >
              {order.status === "CONFIRMED" ? <ChefHat size={18} /> : <Check size={18} />}
              {busy ? "Updating…" : actionLabel}
              <ArrowRight size={18} />
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
