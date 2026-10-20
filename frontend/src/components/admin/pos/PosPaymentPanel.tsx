"use client";

import { Banknote, Check, CreditCard, Plus } from "lucide-react";
import type { PaymentMethod } from "@/lib/types";
import { pkr } from "@/lib/format";
import { suggestQuickTenders, type PosPaymentRow } from "@/lib/pos/checkout-helpers";

type Props = {
  payment: PaymentMethod;
  total: number;
  cashTendered: string;
  splitRows: PosPaymentRow[];
  onPaymentChange: (m: PaymentMethod) => void;
  onCashTenderedChange: (v: string) => void;
  onSplitRowsChange: (rows: PosPaymentRow[]) => void;
};

export function PosPaymentPanel({
  payment,
  total,
  cashTendered,
  splitRows,
  onPaymentChange,
  onCashTenderedChange,
  onSplitRowsChange,
}: Props) {
  const splitActive = splitRows.length > 1;
  const cashPortion = splitActive
    ? splitRows.filter((r) => r.method === "CASH").reduce((s, r) => s + r.amount, 0)
    : payment === "CASH"
      ? total
      : 0;
  const tenderedNum = cashTendered.trim() ? Number(cashTendered) : null;
  const quick = suggestQuickTenders(cashPortion || total);

  function startSplit(second: PaymentMethod) {
    const first: PaymentMethod = second === "CARD" ? "CASH" : "CARD";
    const half = Math.round((total / 2) * 100) / 100;
    onSplitRowsChange([
      { method: first, amount: half },
      { method: second, amount: total - half },
    ]);
    onPaymentChange(first);
  }

  function clearSplit() {
    onSplitRowsChange([]);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {(["CASH", "CARD"] as PaymentMethod[]).map((m) => {
          const active = !splitActive && payment === m;
          const Icon = m === "CASH" ? Banknote : CreditCard;
          return (
            <button
              key={m}
              type="button"
              onClick={() => {
                clearSplit();
                onPaymentChange(m);
              }}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold ring-1 ${
                active
                  ? "bg-stone-900 text-white ring-stone-900 dark:bg-stone-100 dark:text-stone-900"
                  : "bg-white text-stone-600 ring-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-600"
              }`}
            >
              {active ? <Check size={16} aria-hidden /> : <Icon size={16} aria-hidden />}
              {m === "CASH" ? "Cash" : "Card"}
            </button>
          );
        })}
      </div>

      {!splitActive && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="min-h-11 rounded-lg px-3 text-xs font-bold ring-1 ring-stone-200 dark:ring-stone-600"
            onClick={() => startSplit("CARD")}
          >
            <Plus size={12} className="inline" /> Split payment
          </button>
        </div>
      )}

      {splitActive && (
        <div className="space-y-2 rounded-xl border border-stone-200 p-3 dark:border-stone-600">
          <p className="text-xs font-bold text-stone-600 dark:text-stone-300">Split payment</p>
          {splitRows.map((row, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <select
                className="input h-11 text-sm"
                value={row.method}
                onChange={(e) => {
                  const next = [...splitRows];
                  next[i] = { ...row, method: e.target.value as PaymentMethod };
                  onSplitRowsChange(next);
                }}
              >
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
              </select>
              <input
                className="input h-11 text-sm"
                type="number"
                min={0}
                value={row.amount}
                onChange={(e) => {
                  const next = [...splitRows];
                  next[i] = { ...row, amount: Number(e.target.value) };
                  onSplitRowsChange(next);
                }}
              />
            </div>
          ))}
          <button type="button" className="text-xs font-semibold text-brand-700" onClick={clearSplit}>
            Use single method
          </button>
        </div>
      )}

      {(payment === "CASH" || splitRows.some((r) => r.method === "CASH")) && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-11 rounded-lg bg-stone-100 px-3 text-xs font-bold dark:bg-stone-800"
              onClick={() => onCashTenderedChange(String(quick.exact))}
            >
              Exact {pkr(quick.exact)}
            </button>
            {quick.amounts.map((a) => (
              <button
                key={a}
                type="button"
                className="min-h-11 rounded-lg bg-stone-100 px-3 text-xs font-bold dark:bg-stone-800"
                onClick={() => onCashTenderedChange(String(a))}
              >
                {pkr(a)}
              </button>
            ))}
          </div>
          <input
            className="input h-11 w-full text-sm"
            type="number"
            min={0}
            inputMode="decimal"
            placeholder="Cash tendered"
            value={cashTendered}
            onChange={(e) => onCashTenderedChange(e.target.value)}
            aria-label="Cash tendered"
          />
          {tenderedNum != null && Number.isFinite(tenderedNum) && tenderedNum >= cashPortion && cashPortion > 0 && (
            <p className="text-base font-semibold text-stone-800 dark:text-stone-100" aria-live="polite">
              Change due {pkr(tenderedNum - cashPortion)}
            </p>
          )}
          {tenderedNum != null && Number.isFinite(tenderedNum) && tenderedNum < cashPortion && (
            <p className="text-base font-semibold text-rose-700" aria-live="polite">
              Short {pkr(cashPortion - tenderedNum)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
