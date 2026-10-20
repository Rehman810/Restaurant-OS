"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Ban, Clock, Loader2, MapPin, X } from "lucide-react";
import type { AvailabilityPatch } from "@/lib/admin-menu/api";

const CLOSE_MS = 340;

type Props = {
  open: boolean;
  dishName: string;
  onClose: () => void;
  onApply: (patch: AvailabilityPatch) => Promise<void>;
  canAllBranches: boolean;
};

function OptionCard({
  selected,
  title,
  description,
  onSelect,
}: {
  selected: boolean;
  title: string;
  description?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
        selected
          ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500 dark:bg-brand-950/40"
          : "border-stone-200 bg-white hover:border-stone-300 dark:border-stone-600 dark:bg-stone-900"
      }`}
    >
      <p className="text-sm font-semibold text-stone-900 dark:text-stone-50">{title}</p>
      {description && <p className="mt-0.5 text-xs text-stone-600 dark:text-stone-400">{description}</p>}
    </button>
  );
}

export function DishAvailabilitySheet({ open, dishName, onClose, onApply, canAllBranches }: Props) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [mode, setMode] = useState<"manual" | "today" | "datetime">("today");
  const [untilIso, setUntilIso] = useState("");
  const [scope, setScope] = useState<"currentBranch" | "allBranches">("currentBranch");
  const [busy, setBusy] = useState(false);

  const close = useCallback(() => {
    if (busy) return;
    setClosing(true);
    setVisible(false);
    window.setTimeout(onClose, CLOSE_MS);
  }, [busy, onClose]);

  useEffect(() => {
    if (!open) return;
    setClosing(false);
    setMode("today");
    setScope("currentBranch");
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close]);

  if (!open) return null;

  async function submit() {
    setBusy(true);
    try {
      let until: AvailabilityPatch["until"] = null;
      if (mode === "today") until = "endOfDay";
      if (mode === "datetime" && untilIso) until = new Date(untilIso).toISOString();
      await onApply({
        state: "soldOut",
        until,
        scope: canAllBranches ? scope : "currentBranch",
      });
      close();
    } finally {
      setBusy(false);
    }
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
        aria-labelledby="avail-sheet-title"
        className={`drawer-panel relative flex h-full w-full max-w-[420px] flex-col rounded-l-2xl bg-white shadow-[-12px_0_48px_rgba(0,0,0,0.2)] dark:bg-stone-900 ${
          visible && !closing ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-1 shrink-0 rounded-tl-2xl bg-amber-500" />
        <header className="shrink-0 border-b border-stone-100 px-6 py-4 dark:border-stone-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-stone-500">Mark sold out</p>
              <h2 id="avail-sheet-title" className="mt-0.5 flex items-center gap-2 text-lg font-semibold text-stone-900 dark:text-stone-50">
                <Ban size={18} className="text-amber-600" />
                {dishName}
              </h2>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={close}
              className="grid h-9 w-9 place-items-center rounded-full border border-stone-200 text-stone-500 dark:border-stone-600"
            >
              <X size={18} />
            </button>
          </div>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
            Customers won&apos;t be able to order this at the selected branch(es). Price and description stay shared.
          </p>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
              <Clock size={14} /> How long?
            </h3>
            <div className="space-y-2">
              <OptionCard
                selected={mode === "today"}
                title="For today"
                description="Clears at the start of the next store day"
                onSelect={() => setMode("today")}
              />
              <OptionCard
                selected={mode === "manual"}
                title="Until I turn it back on"
                onSelect={() => setMode("manual")}
              />
              <OptionCard
                selected={mode === "datetime"}
                title="Until a specific time"
                onSelect={() => setMode("datetime")}
              />
            </div>
            {mode === "datetime" && (
              <label className="mt-3 block">
                <span className="text-xs font-medium text-stone-500">Resume at</span>
                <input
                  type="datetime-local"
                  value={untilIso}
                  onChange={(e) => setUntilIso(e.target.value)}
                  className="input mt-1 w-full"
                />
              </label>
            )}
          </section>

          {canAllBranches && (
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                <MapPin size={14} /> Where
              </h3>
              <div className="space-y-2">
                <OptionCard
                  selected={scope === "currentBranch"}
                  title="This branch only"
                  description="Uses the branch in the admin header"
                  onSelect={() => setScope("currentBranch")}
                />
                <OptionCard
                  selected={scope === "allBranches"}
                  title="All branches"
                  onSelect={() => setScope("allBranches")}
                />
              </div>
            </section>
          )}
        </div>

        <footer className="flex shrink-0 gap-2 border-t border-stone-100 bg-stone-50/90 px-6 py-4 dark:border-stone-800 dark:bg-stone-950/80">
          <button type="button" onClick={close} disabled={busy} className="min-h-11 flex-1 rounded-xl border border-stone-200 text-sm font-semibold dark:border-stone-600">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || (mode === "datetime" && !untilIso)}
            onClick={() => void submit()}
            className="btn-primary min-h-11 flex-1 inline-flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            {busy ? "Saving…" : "Mark sold out"}
          </button>
        </footer>
      </aside>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(sheet, document.body);
}
