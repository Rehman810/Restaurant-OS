"use client";

import { X } from "lucide-react";
import type { AdminOrderRow } from "@/lib/admin-orders/types";
import { pkr } from "@/lib/format";

export function UnassignedOrderPickerSheet({
  open,
  riderName,
  orders,
  onClose,
  onSelect,
}: {
  open: boolean;
  riderName: string;
  orders: AdminOrderRow[];
  onClose: () => void;
  onSelect: (orderId: string) => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-stone-950/50 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose delivery to assign"
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-3xl border border-stone-200 bg-white shadow-xl dark:border-stone-600 dark:bg-stone-900"
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4 dark:border-stone-700">
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-50">
            Assign to {riderName}
          </h2>
          <button
            type="button"
            aria-label="Close"
            className="grid h-10 w-10 place-items-center rounded-full border border-stone-200 dark:border-stone-600"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {orders.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                className="flex w-full min-h-[52px] flex-col rounded-xl px-3 py-3 text-left hover:bg-stone-50 dark:hover:bg-stone-800"
                onClick={() => onSelect(o.id)}
              >
                <span className="font-bold text-stone-900 dark:text-stone-100">{o.shortDisplay}</span>
                <span className="text-xs text-stone-500">
                  {o.customer.name} · {pkr(o.totals.total)}
                </span>
              </button>
            </li>
          ))}
          {!orders.length && (
            <p className="px-3 py-6 text-center text-sm text-stone-500">No unassigned deliveries.</p>
          )}
        </ul>
      </div>
    </div>
  );
}
