"use client";

import { pkr } from "@/lib/format";

type Props = {
  open: boolean;
  onClose: () => void;
  cashierName: string;
  openedAt: string;
  openingCash: number;
  expectedCash: number;
  cashSales: number;
  paidIn: number;
  paidOut: number;
  orderCount: number;
  onPaidIn: () => void;
  onPaidOut: () => void;
  onCloseShift: () => void;
};

export function PosShiftSummarySheet({
  open,
  onClose,
  cashierName,
  openedAt,
  openingCash,
  expectedCash,
  cashSales,
  paidIn,
  paidOut,
  orderCount,
  onPaidIn,
  onPaidOut,
  onCloseShift,
}: Props) {
  if (!open) return null;

  const openedLabel = new Date(openedAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-stone-950/50 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl dark:bg-stone-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-stone-900 dark:text-stone-50">Cash shift</h2>
          <button type="button" className="text-sm font-semibold text-stone-500" onClick={onClose}>
            Close
          </button>
        </div>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-stone-500">Cashier</dt>
            <dd className="font-semibold text-stone-900 dark:text-stone-100">{cashierName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-500">Opened</dt>
            <dd className="font-medium tabular-nums">{openedLabel}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-500">Opening float</dt>
            <dd className="font-medium tabular-nums">{pkr(openingCash)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-500">Cash sales</dt>
            <dd className="font-medium tabular-nums">{pkr(cashSales)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-500">Paid in</dt>
            <dd className="font-medium tabular-nums">{pkr(paidIn)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-500">Paid out</dt>
            <dd className="font-medium tabular-nums">{pkr(paidOut)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-stone-200 pt-2 dark:border-stone-700">
            <dt className="font-semibold text-stone-700 dark:text-stone-200">Expected cash</dt>
            <dd className="text-lg font-black tabular-nums text-brand-700 dark:text-brand-300">{pkr(expectedCash)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-500">POS orders</dt>
            <dd className="font-medium tabular-nums">{orderCount}</dd>
          </div>
        </dl>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button type="button" className="btn-ghost text-xs" onClick={onPaidIn}>Paid in</button>
          <button type="button" className="btn-ghost text-xs" onClick={onPaidOut}>Paid out</button>
          <button type="button" className="btn-primary text-xs" onClick={onCloseShift}>Close shift</button>
        </div>
      </div>
    </div>
  );
}
