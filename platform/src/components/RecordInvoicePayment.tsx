"use client";

import { FormEvent, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatPkr } from "@/lib/format";

const METHODS = [
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "JAZZCASH", label: "JazzCash" },
  { value: "EASYPAISA", label: "Easypaisa" },
  { value: "CASH", label: "Cash" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "OTHER", label: "Other" },
] as const;

export type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  status: string;
  amountPkr: number;
  dueAt: string;
  paidAt: string | null;
};

export function RecordInvoicePayment({
  invoice,
  onRecorded,
}: {
  invoice: InvoiceRow;
  onRecorded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<string>("BANK_TRANSFER");
  const [amountPkr, setAmountPkr] = useState(String(invoice.amountPkr));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api(`/invoices/${invoice.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          method,
          amountPkr: Math.round(Number(amountPkr)),
          reference: reference.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      setOpen(false);
      onRecorded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record payment.");
    } finally {
      setSaving(false);
    }
  }

  if (invoice.status === "PAID") {
    return <span className="text-xs text-emerald-600">Paid</span>;
  }

  if (!open) {
    return (
      <button type="button" className="cursor-pointer text-xs font-semibold text-accent-500 hover:underline" onClick={() => setOpen(true)}>
        Record payment
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
      <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
        {invoice.invoiceNumber} · due {formatPkr(invoice.amountPkr)}
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="text-xs">
          Method
          <select className="input mt-1 py-1.5 text-xs" value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Amount (PKR)
          <input
            className="input mt-1 py-1.5 text-xs"
            type="number"
            min={1}
            required
            value={amountPkr}
            onChange={(e) => setAmountPkr(e.target.value)}
          />
        </label>
        <label className="text-xs sm:col-span-2">
          Reference
          <input className="input mt-1 py-1.5 text-xs" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Txn / cheque #" />
        </label>
        <label className="text-xs sm:col-span-2">
          Notes
          <input className="input mt-1 py-1.5 text-xs" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
      {error ? <p className="mt-2 text-xs text-rose-500">{error}</p> : null}
      <div className="mt-2 flex gap-2">
        <button type="submit" className="btn-primary py-1.5 text-xs" disabled={saving}>
          {saving ? "Saving…" : "Confirm"}
        </button>
        <button type="button" className="btn-secondary py-1.5 text-xs" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
