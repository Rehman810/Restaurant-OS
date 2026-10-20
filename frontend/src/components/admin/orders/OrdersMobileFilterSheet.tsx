"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { OrdersFilterBar } from "./OrdersFilterBar";
import type { QuickDatePreset } from "@/lib/order-dates";
import type { AdminPaymentFilter } from "@/lib/admin-orders/types";
import type { FulfillmentType } from "@/lib/types";
import type { Rider } from "@/lib/admin-types";

export function OrdersMobileFilterSheet(props: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  compactLabel: string;
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
  onRiderFilter: (id: string) => void;
  onView: (v: "table" | "board") => void;
}) {
  const { open, onOpen, onClose, compactLabel, ...bar } = props;

  return (
    <>
      <div className="flex items-center gap-2 lg:hidden">
        <button
          type="button"
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold text-stone-800 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
          onClick={onOpen}
          aria-expanded={open}
          aria-controls="orders-mobile-filters"
        >
          <SlidersHorizontal size={16} />
          {compactLabel}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[90] lg:hidden" role="presentation">
          <button type="button" className="absolute inset-0 bg-stone-950/50" aria-label="Close filters" onClick={onClose} />
          <div
            id="orders-mobile-filters"
            role="dialog"
            aria-modal="true"
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-50">Filters</h2>
              <button
                type="button"
                aria-label="Close"
                className="grid h-11 w-11 place-items-center rounded-full border border-stone-200 dark:border-stone-600"
                onClick={onClose}
              >
                <X size={18} />
              </button>
            </div>
            <OrdersFilterBar {...bar} variant="sheet" />
          </div>
        </div>
      )}
    </>
  );
}
