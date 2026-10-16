"use client";

import { useCallback, useEffect, useState } from "react";
import { Banknote, DoorClosed, DoorOpen, Minus, Plus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { pkr } from "@/lib/format";
import { InputSheet } from "@/components/admin/InputSheet";
import { enqueueCashMovement, saveShiftSnapshot } from "@/lib/offline/pos-db";
import { getDeviceLabel } from "@/lib/offline/device-label";

type ShiftReport = {
  expectedCash: number;
  counted: number | null;
  variance: number | null;
  byType: Record<string, number>;
};

type Shift = {
  id: string;
  openedAt: string;
  openingCash: string | number;
  status: string;
};

const DENOMS = [
  { key: "5000", label: "5000" },
  { key: "1000", label: "1000" },
  { key: "500", label: "500" },
  { key: "100", label: "100" },
  { key: "50", label: "50" },
  { key: "20", label: "20" },
  { key: "10", label: "10" },
  { key: "coins", label: "Coins" },
] as const;

export function CashShiftPanel({
  paymentMethod,
  onShiftChange,
}: {
  paymentMethod: "CASH" | "CARD";
  onShiftChange: (open: boolean) => void;
}) {
  const [shift, setShift] = useState<Shift | null>(null);
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [openSheet, setOpenSheet] = useState(false);
  const [closeSheet, setCloseSheet] = useState(false);
  const [movementSheet, setMovementSheet] = useState<"in" | "out" | null>(null);
  const [denoms, setDenoms] = useState<Record<string, string>>({});
  const [managerNote, setManagerNote] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api<{ shift: Shift | null; report?: ShiftReport }>("/pos/shift/current");
      setShift(data.shift);
      setReport(data.report ?? null);
      onShiftChange(Boolean(data.shift));
      if (data.shift) {
        void saveShiftSnapshot({ shift: data.shift, report: data.report ?? null });
      }
    } catch {
      setShift(null);
      onShiftChange(false);
    }
  }, [onShiftChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const denomTotal = DENOMS.reduce((sum, d) => {
    const n = Number(denoms[d.key] || 0);
    const mult = d.key === "coins" ? 1 : Number(d.key);
    return sum + (Number.isFinite(n) ? n : 0) * mult;
  }, 0);

  async function openShift(openingCash: string) {
    setError("");
    if (!navigator.onLine) {
      setError("Opening a shift requires an internet connection.");
      return;
    }
    try {
      await api("/pos/shift/open", {
        method: "POST",
        body: JSON.stringify({ openingCash: Number(openingCash) || 0 }),
      });
      setOpenSheet(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open shift.");
    }
  }

  async function closeShift() {
    setError("");
    if (!navigator.onLine) {
      setError("Closing a shift requires an internet connection.");
      return;
    }
    try {
      const body: Record<string, unknown> = {
        countedCash: denomTotal,
        denominations: Object.fromEntries(
          DENOMS.map((d) => [d.key, Number(denoms[d.key] || 0)])
        ),
        managerNote: managerNote.trim() || undefined,
      };
      await api("/pos/shift/close", { method: "POST", body: JSON.stringify(body) });
      setCloseSheet(false);
      setDenoms({});
      setManagerNote("");
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.code === "VARIANCE_NOTE_REQUIRED") {
        setError("Variance too high — add a manager note below.");
      } else {
        setError(e instanceof Error ? e.message : "Could not close shift.");
      }
    }
  }

  async function movement(amount: string, reason: string) {
    if (!movementSheet) return;
    const type = movementSheet === "in" ? "PAID_IN" : "PAID_OUT";
    const amt = Number(amount);
    const reasonText = reason.trim() || (type === "PAID_IN" ? "Paid in" : "Paid out");
    if (!navigator.onLine) {
      await enqueueCashMovement({
        clientMovementId: crypto.randomUUID(),
        type,
        amount: amt,
        reason: reasonText,
        clientCreatedAt: new Date().toISOString(),
        deviceLabel: getDeviceLabel(),
        status: "pending",
        attempts: 0,
      });
      setMovementSheet(null);
      return;
    }
    const path = movementSheet === "in" ? "/pos/shift/paid-in" : "/pos/shift/paid-out";
    await api(path, {
      method: "POST",
      body: JSON.stringify({ amount: amt, reason: reasonText }),
    });
    setMovementSheet(null);
    await load();
  }

  if (!shift) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
        <p className="font-semibold text-amber-900 dark:text-amber-100">No cash shift open</p>
        {paymentMethod === "CASH" && (
          <p className="text-xs text-amber-800 dark:text-amber-200">Open a shift before charging cash.</p>
        )}
        <button type="button" className="btn-primary mt-2 w-full text-xs" onClick={() => setOpenSheet(true)}>
          <DoorOpen size={14} /> Open shift
        </button>
        <InputSheet
          open={openSheet}
          title="Open cash shift"
          label="Opening float (Rs)"
          initialValue="0"
          saving={false}
          error={error}
          onClose={() => setOpenSheet(false)}
          onConfirm={openShift}
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-semibold text-emerald-900 dark:text-emerald-100">
          <Banknote size={14} /> Shift open · float {pkr(shift.openingCash)}
        </span>
        <span className="text-xs text-emerald-700 dark:text-emerald-300">
          Expected {pkr(report?.expectedCash ?? shift.openingCash)}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1">
        <button type="button" className="btn-ghost text-[10px] py-1" onClick={() => setMovementSheet("in")}>
          <Plus size={12} /> Paid in
        </button>
        <button type="button" className="btn-ghost text-[10px] py-1" onClick={() => setMovementSheet("out")}>
          <Minus size={12} /> Paid out
        </button>
        <button type="button" className="btn-ghost text-[10px] py-1" onClick={() => setCloseSheet(true)}>
          <DoorClosed size={12} /> Close
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}

      <InputSheet
        open={movementSheet !== null}
        title={movementSheet === "in" ? "Paid in" : "Paid out"}
        label="Amount (Rs)"
        saving={false}
        onClose={() => setMovementSheet(null)}
        onConfirm={(amount) => movement(amount, movementSheet === "in" ? "Paid in" : "Paid out")}
      />

      {closeSheet && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-stone-950/50 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-stone-200 bg-white p-5 shadow-xl dark:border-stone-600 dark:bg-stone-900">
            <h2 className="text-lg font-semibold">Close shift</h2>
            <p className="mt-1 text-sm text-stone-500">Count bills in the drawer.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {DENOMS.map((d) => (
                <label key={d.key} className="text-xs">
                  {d.label}
                  <input
                    className="input mt-0.5 w-full"
                    type="number"
                    min={0}
                    value={denoms[d.key] ?? ""}
                    onChange={(e) => setDenoms((prev) => ({ ...prev, [d.key]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
            <p className="mt-3 font-bold">Counted: {pkr(denomTotal)}</p>
            <p className="text-sm text-stone-600">Expected: {pkr(report?.expectedCash ?? 0)}</p>
            {Math.abs(denomTotal - (report?.expectedCash ?? 0)) > 0.01 && (
              <p className="text-sm text-amber-700">
                Variance: {pkr(denomTotal - (report?.expectedCash ?? 0))}
              </p>
            )}
            <textarea
              className="input mt-3 w-full text-sm"
              placeholder="Manager note (required if variance is high)"
              value={managerNote}
              onChange={(e) => setManagerNote(e.target.value)}
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" className="btn-ghost" onClick={() => setCloseSheet(false)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={() => void closeShift()}>Close shift</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
