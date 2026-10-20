"use client";

import { LayoutGrid, Search, Table2 } from "lucide-react";
import type { QuickDatePreset } from "@/lib/order-dates";
import type { AdminPaymentFilter } from "@/lib/admin-orders/types";
import type { FulfillmentType } from "@/lib/types";
import type { Rider } from "@/lib/admin-types";

const PRESETS: { id: QuickDatePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "custom", label: "Custom" },
];

const chipBase =
  "inline-flex h-9 shrink-0 items-center rounded-full px-3 text-xs font-bold ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2";
const selectClass =
  "h-9 rounded-lg border border-stone-200 bg-white px-2.5 text-xs font-semibold text-stone-800 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100";
const chipOn =
  "bg-brand-50 text-brand-900 ring-brand-200 dark:bg-brand-950/50 dark:text-brand-100 dark:ring-brand-800";
const chipOff =
  "bg-white text-stone-700 ring-stone-200 hover:bg-stone-50 dark:bg-stone-900 dark:text-stone-200 dark:ring-stone-700";

type OrdersFilterBarProps = {
  preset: QuickDatePreset | null;
  from: string;
  to: string;
  search: string;
  typeFilter: FulfillmentType | "ALL";
  paymentFilter: AdminPaymentFilter | "ALL";
  sourceFilter: "ALL" | "online" | "pos";
  riderFilter: string;
  riders: Rider[];
  view: "table" | "board";
  onPreset: (p: QuickDatePreset) => void;
  onCustomRange: (from: string, to: string) => void;
  onSearch: (q: string) => void;
  onTypeFilter: (t: FulfillmentType | "ALL") => void;
  onPaymentFilter: (p: AdminPaymentFilter | "ALL") => void;
  onSourceFilter: (s: "ALL" | "online" | "pos") => void;
  onRiderFilter: (riderId: string) => void;
  onView: (v: "table" | "board") => void;
  variant?: "bar" | "sheet";
};

export function OrdersFilterBar(props: OrdersFilterBarProps) {
  const { variant = "bar", ...rest } = props;
  return <OrdersFilterBarInner variant={variant} {...rest} />;
}

function OrdersFilterBarInner({
  preset,
  from,
  to,
  search,
  typeFilter,
  paymentFilter,
  sourceFilter,
  riderFilter,
  riders,
  view,
  onPreset,
  onCustomRange,
  onSearch,
  onTypeFilter,
  onPaymentFilter,
  onSourceFilter,
  onRiderFilter,
  onView,
  variant = "bar",
}: OrdersFilterBarProps) {
  return (
    <div
      className={`rounded-2xl border border-stone-200/60 bg-white/90 p-3 shadow-sm backdrop-blur-sm dark:border-stone-700 dark:bg-stone-900/90 ${
        variant === "bar" ? "hidden lg:block" : ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          <div className="flex gap-1">
            {PRESETS.map((p) => {
              const active = preset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPreset(p.id)}
                  className={`${chipBase} ${active ? chipOn : chipOff}`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          {preset === "custom" && (
            <div className="flex shrink-0 items-center gap-1.5">
              <input
                type="date"
                className={`${selectClass} w-[8.5rem]`}
                value={from}
                onChange={(e) => onCustomRange(e.target.value, to)}
                aria-label="From date"
              />
              <span className="text-stone-400">–</span>
              <input
                type="date"
                className={`${selectClass} w-[8.5rem]`}
                value={to}
                onChange={(e) => onCustomRange(from, e.target.value)}
                aria-label="To date"
              />
            </div>
          )}
        </div>

        <div className="inline-flex shrink-0 rounded-xl bg-stone-100 p-0.5 ring-1 ring-stone-200 dark:bg-stone-800 dark:ring-stone-700">
          <button
            type="button"
            onClick={() => onView("table")}
            aria-pressed={view === "table"}
            className={`inline-flex h-8 items-center gap-1 rounded-lg px-3 text-xs font-bold ${
              view === "table" ? chipOn : "text-stone-500"
            }`}
          >
            <Table2 size={15} aria-hidden /> Table
          </button>
          <button
            type="button"
            onClick={() => onView("board")}
            aria-pressed={view === "board"}
            className={`inline-flex h-8 items-center gap-1 rounded-lg px-3 text-xs font-bold ${
              view === "board" ? chipOn : "text-stone-500"
            }`}
          >
            <LayoutGrid size={15} aria-hidden /> Board
          </button>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden />
          <input
            className="h-9 w-full rounded-lg border border-stone-200 bg-stone-50 py-0 pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-stone-600 dark:bg-stone-800"
            placeholder="Search order, name, phone…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>

        <select
          className={`${selectClass} w-[7.5rem]`}
          value={typeFilter}
          onChange={(e) => onTypeFilter(e.target.value as FulfillmentType | "ALL")}
          aria-label="Order type"
        >
          <option value="ALL">All types</option>
          <option value="DELIVERY">Delivery</option>
          <option value="PICKUP">Takeaway</option>
          <option value="DINE_IN">Dine-in</option>
        </select>

        <select
          className={`${selectClass} w-[7.5rem]`}
          value={paymentFilter}
          onChange={(e) => onPaymentFilter(e.target.value as AdminPaymentFilter | "ALL")}
          aria-label="Payment"
        >
          <option value="ALL">All payments</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
          <option value="cod">COD</option>
          <option value="partial">Partly paid</option>
        </select>

        <select
          className={`${selectClass} w-[6.5rem]`}
          value={sourceFilter}
          onChange={(e) => onSourceFilter(e.target.value as "ALL" | "online" | "pos")}
          aria-label="Source"
        >
          <option value="ALL">All sources</option>
          <option value="online">Online</option>
          <option value="pos">POS</option>
        </select>

        <select
          className={`${selectClass} min-w-[7.5rem] max-w-[9rem]`}
          value={riderFilter}
          onChange={(e) => onRiderFilter(e.target.value)}
          aria-label="Rider"
        >
          <option value="">All riders</option>
          {riders.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
