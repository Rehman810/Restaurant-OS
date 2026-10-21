"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Ban, X } from "lucide-react";
import { AdminCustomer } from "@/lib/admin-types";

const CLOSE_MS = 340;

export function BlockCustomerSheet({
  customer,
  saving,
  error,
  onClose,
  onConfirm,
}: {
  customer: AdminCustomer | null;
  saving: boolean;
  error: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reason, setReason] = useState("");

  const close = useCallback(() => {
    if (saving) return;
    setClosing(true);
    setVisible(false);
    window.setTimeout(onClose, CLOSE_MS);
  }, [onClose, saving]);

  useEffect(() => {
    if (!customer) return;
    setReason("");
    setClosing(false);
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [customer, close]);

  if (!customer) return null;

  function submit(e: FormEvent) {
    e.preventDefault();
    onConfirm(reason.trim());
  }

  const sheet = (
    <div className="fixed inset-0 z-[100] flex justify-end" aria-hidden={closing}>
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className={`drawer-backdrop absolute inset-0 bg-stone-950/60 backdrop-blur-[4px] ${
          visible && !closing ? "opacity-100" : "opacity-0"
        }`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Block customer"
        className={`drawer-panel relative flex h-full w-full max-w-[440px] flex-col rounded-l-2xl bg-white shadow-[-12px_0_48px_rgba(0,0,0,0.2)] dark:bg-stone-900 dark:text-stone-100 dark:ring-1 dark:ring-stone-700 ${
          visible && !closing ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-1 shrink-0 rounded-tl-2xl bg-rose-500" />
        <header className="shrink-0 border-b border-stone-100 px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-stone-500">Stop new orders</p>
              <h2 className="mt-0.5 flex items-center gap-2 text-xl font-semibold text-stone-900">
                <Ban size={18} className="text-rose-600" />
                Block {customer.name}
              </h2>
            </div>
            <button
              type="button"
              onClick={close}
              className="grid h-9 w-9 place-items-center rounded-full border border-stone-200 text-stone-500 hover:bg-stone-100"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <p className="text-sm leading-relaxed text-stone-600">
              {customer.name} will not be able to place orders with {customer.email}
              {customer.phone ? ` or ${customer.phone}` : ""}.
            </p>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-500 dark:text-stone-400" htmlFor="block-reason">
                Reason (optional)
              </label>
              <textarea
                id="block-reason"
                className="input min-h-28 resize-y dark:bg-stone-950 dark:border-stone-700"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this customer blocked?"
              />
            </div>
            {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
          </div>
          <div className="flex shrink-0 gap-2 border-t border-stone-100 px-6 py-4">
            <button type="button" onClick={close} className="btn-ghost flex-1" disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex flex-1 items-center justify-center rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving}
            >
              {saving ? "Blocking…" : "Block customer"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );

  return createPortal(sheet, document.body);
}
