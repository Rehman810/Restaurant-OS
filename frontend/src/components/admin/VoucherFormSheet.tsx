"use client";

import { Dispatch, FormEvent, SetStateAction, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, TicketPercent, X } from "lucide-react";
import { AdminSelect } from "./AdminSelect";
import { CATEGORY_WEEKDAYS } from "./CategoryFormSheet";

const CLOSE_MS = 340;

export type VoucherFormData = {
  code: string;
  name: string;
  description: string;
  type: "PERCENT" | "FIXED";
  value: string;
  minSubtotal: string;
  maxSubtotal: string;
  maxDiscount: string;
  usageLimit: string;
  perCustomerLimit: string;
  firstOrderOnly: boolean;
  startsAt: string;
  endsAt: string;
  scheduleDays: number[];
  scheduleStartTime: string;
  scheduleEndTime: string;
  channelOnline: boolean;
  channelPos: boolean;
  channelDineIn: boolean;
  validDelivery: boolean;
  validPickup: boolean;
  validDineIn: boolean;
  isActive: boolean;
};

export const emptyVoucher: VoucherFormData = {
  code: "",
  name: "",
  description: "",
  type: "PERCENT",
  value: "10",
  minSubtotal: "",
  maxSubtotal: "",
  maxDiscount: "",
  usageLimit: "",
  perCustomerLimit: "1",
  firstOrderOnly: false,
  startsAt: "",
  endsAt: "",
  scheduleDays: [],
  scheduleStartTime: "",
  scheduleEndTime: "",
  channelOnline: true,
  channelPos: true,
  channelDineIn: true,
  validDelivery: true,
  validPickup: true,
  validDineIn: true,
  isActive: true,
};

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-brand-600" />
      {label}
    </label>
  );
}

export function VoucherFormSheet({
  open,
  editingId,
  form,
  setForm,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editingId: string | null;
  form: VoucherFormData;
  setForm: Dispatch<SetStateAction<VoucherFormData>>;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  const close = useCallback(() => {
    setClosing(true);
    setVisible(false);
    window.setTimeout(onClose, CLOSE_MS);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    setClosing(false);
    document.body.style.overflow = "hidden";
    const r1 = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(r1);
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  if (!open) return null;

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
        aria-labelledby="voucher-sheet-title"
        className={`drawer-panel relative flex h-full w-full max-w-[520px] flex-col rounded-l-2xl bg-white shadow-[-12px_0_48px_rgba(0,0,0,0.2)] dark:bg-stone-900 ${
          visible && !closing ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-1 shrink-0 rounded-tl-2xl bg-brand-600" />
        <header className="shrink-0 border-b border-stone-100 px-6 py-4 dark:border-stone-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-stone-500">{editingId ? "Edit voucher" : "New voucher"}</p>
              <h2 id="voucher-sheet-title" className="mt-0.5 flex items-center gap-2 text-xl font-semibold text-stone-900 dark:text-stone-50">
                <TicketPercent size={18} className="text-brand-600" />
                {editingId ? "Update promo voucher" : "Create promo voucher"}
              </h2>
              <p className="mt-1 text-sm text-stone-500">Set the code, discount, and the rules for when it can be used.</p>
            </div>
            <button type="button" onClick={close} className="grid h-11 w-11 place-items-center rounded-full border border-stone-200 text-stone-500 hover:bg-stone-100 dark:border-stone-600">
              <X size={18} />
            </button>
          </div>
        </header>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Code</p>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-stone-500" htmlFor="voucher-code">
                  Voucher code
                </label>
                <input
                  id="voucher-code"
                  className="input font-mono uppercase tracking-wide"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  required
                  placeholder="e.g. WELCOME10"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-stone-500" htmlFor="voucher-name">
                  Display name (optional)
                </label>
                <input
                  id="voucher-name"
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Welcome 10% off"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-stone-500" htmlFor="voucher-desc">
                  Description (optional)
                </label>
                <textarea
                  id="voucher-desc"
                  className="input min-h-[64px] resize-none"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Shown internally so staff know what this voucher is for."
                />
              </div>
            </section>

            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Discount</p>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-stone-500">Discount type</label>
                <AdminSelect
                  value={form.type}
                  onChange={(v) => setForm((f) => ({ ...f, type: v as "PERCENT" | "FIXED" }))}
                  options={[
                    { value: "PERCENT", label: "Percent off" },
                    { value: "FIXED", label: "Fixed amount (Rs)" },
                  ]}
                  aria-label="Discount type"
                  className="w-full"
                  minWidth="w-full"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-stone-500" htmlFor="voucher-value">
                  {form.type === "PERCENT" ? "Percent off" : "Amount off (Rs)"}
                </label>
                <input
                  id="voucher-value"
                  className="input"
                  type="number"
                  min={1}
                  max={form.type === "PERCENT" ? 100 : undefined}
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                  required
                />
              </div>
              {form.type === "PERCENT" ? (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-stone-500" htmlFor="voucher-max">
                    Max discount cap (Rs, optional)
                  </label>
                  <input
                    id="voucher-max"
                    className="input"
                    type="number"
                    min={0}
                    value={form.maxDiscount}
                    onChange={(e) => setForm((f) => ({ ...f, maxDiscount: e.target.value }))}
                    placeholder="No cap"
                  />
                  <p className="mt-1 text-xs text-stone-500">Stops a large order from taking too much percent off.</p>
                </div>
              ) : null}
            </section>

            <section className="space-y-3 rounded-xl border border-stone-200 p-3 dark:border-stone-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Order amount</p>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-stone-500" htmlFor="voucher-min">
                  Minimum order (Rs)
                </label>
                <input
                  id="voucher-min"
                  className="input"
                  type="number"
                  min={0}
                  value={form.minSubtotal}
                  onChange={(e) => setForm((f) => ({ ...f, minSubtotal: e.target.value }))}
                  placeholder="e.g. 500"
                />
                <p className="mt-1 text-xs text-stone-500">
                  Voucher only works if the cart subtotal is at least this amount. Leave blank for no minimum.
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-stone-500" htmlFor="voucher-max-order">
                  Maximum order (Rs, optional)
                </label>
                <input
                  id="voucher-max-order"
                  className="input"
                  type="number"
                  min={0}
                  value={form.maxSubtotal}
                  onChange={(e) => setForm((f) => ({ ...f, maxSubtotal: e.target.value }))}
                  placeholder="No maximum"
                />
              </div>
            </section>

            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Usage limits</p>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-stone-500" htmlFor="voucher-limit">
                  Total uses (all customers)
                </label>
                <input
                  id="voucher-limit"
                  className="input"
                  type="number"
                  min={1}
                  value={form.usageLimit}
                  onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value }))}
                  placeholder="Unlimited"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-stone-500" htmlFor="voucher-per-customer">
                  Uses per customer
                </label>
                <input
                  id="voucher-per-customer"
                  className="input"
                  type="number"
                  min={1}
                  value={form.perCustomerLimit}
                  onChange={(e) => setForm((f) => ({ ...f, perCustomerLimit: e.target.value }))}
                  placeholder="Unlimited"
                />
                <p className="mt-1 text-xs text-stone-500">Set 1 so each signed-in customer can use it only once.</p>
              </div>
              <ToggleRow
                label="First order only (new customers)"
                checked={form.firstOrderOnly}
                onChange={(firstOrderOnly) => setForm((f) => ({ ...f, firstOrderOnly }))}
              />
            </section>

            <section className="space-y-2 rounded-xl border border-stone-200 p-3 dark:border-stone-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Channels</p>
              <ToggleRow label="Online storefront" checked={form.channelOnline} onChange={(channelOnline) => setForm((f) => ({ ...f, channelOnline }))} />
              <ToggleRow label="POS" checked={form.channelPos} onChange={(channelPos) => setForm((f) => ({ ...f, channelPos }))} />
              <ToggleRow label="Dine-in" checked={form.channelDineIn} onChange={(channelDineIn) => setForm((f) => ({ ...f, channelDineIn }))} />
            </section>

            <section className="space-y-2 rounded-xl border border-stone-200 p-3 dark:border-stone-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Order type</p>
              <ToggleRow label="Delivery" checked={form.validDelivery} onChange={(validDelivery) => setForm((f) => ({ ...f, validDelivery }))} />
              <ToggleRow label="Pickup" checked={form.validPickup} onChange={(validPickup) => setForm((f) => ({ ...f, validPickup }))} />
              <ToggleRow label="Dine-in" checked={form.validDineIn} onChange={(validDineIn) => setForm((f) => ({ ...f, validDineIn }))} />
            </section>

            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Schedule</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-stone-500" htmlFor="voucher-start">
                    Valid from
                  </label>
                  <input
                    id="voucher-start"
                    className="input"
                    type="date"
                    value={form.startsAt}
                    onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-stone-500" htmlFor="voucher-end">
                    Valid until
                  </label>
                  <input
                    id="voucher-end"
                    className="input"
                    type="date"
                    value={form.endsAt}
                    onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                  />
                </div>
              </div>
              <div className="rounded-xl border border-stone-200 p-3 dark:border-stone-700">
                <p className="text-xs font-medium text-stone-500">Weekly hours (optional)</p>
                <p className="mt-1 text-xs text-stone-500">Leave days empty to allow this voucher every day.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CATEGORY_WEEKDAYS.map((d) => {
                    const on = form.scheduleDays.includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            scheduleDays: on ? f.scheduleDays.filter((x) => x !== d.value) : [...f.scheduleDays, d.value],
                          }))
                        }
                        className={`min-h-10 rounded-full px-3 text-xs font-semibold ring-1 ${
                          on ? "bg-brand-600 text-white ring-brand-600" : "bg-white ring-stone-200 dark:bg-stone-900"
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-stone-500">From</label>
                    <input
                      className="input"
                      type="time"
                      value={form.scheduleStartTime}
                      onChange={(e) => setForm((f) => ({ ...f, scheduleStartTime: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-stone-500">Until</label>
                    <input
                      className="input"
                      type="time"
                      value={form.scheduleEndTime}
                      onChange={(e) => setForm((f) => ({ ...f, scheduleEndTime: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </section>

            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
              className={`flex min-h-11 w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium ${
                form.isActive
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-stone-200 bg-stone-50 text-stone-600 dark:border-stone-600"
              }`}
            >
              <span>{form.isActive ? "Active — customers can use it" : "Inactive — hidden from checkout"}</span>
              {form.isActive ? <Check size={16} /> : null}
            </button>
          </div>
          <footer className="flex shrink-0 gap-2 border-t border-stone-100 bg-stone-50/80 px-6 py-4 dark:border-stone-800">
            <button type="button" onClick={close} className="min-h-11 flex-1 rounded-xl border border-stone-200 text-sm font-semibold dark:border-stone-600">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary min-h-11 flex-1">
              {saving ? "Saving…" : editingId ? "Save voucher" : "Create voucher"}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(sheet, document.body);
}
