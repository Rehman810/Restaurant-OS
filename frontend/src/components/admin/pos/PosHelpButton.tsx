"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";

export function PosHelpButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid h-9 w-9 place-items-center rounded-lg text-stone-500 ring-1 ring-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-stone-300 dark:ring-stone-600"
        aria-label="POS keyboard shortcuts"
        title="Shortcuts"
      >
        <HelpCircle size={18} />
      </button>
      {open && (
        <div className="fixed inset-0 z-[115] flex items-end justify-center bg-stone-950/50 p-4 sm:items-center">
          <div
            className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl dark:bg-stone-900"
            role="dialog"
            aria-labelledby="pos-help-title"
          >
            <div className="flex items-center justify-between">
              <h2 id="pos-help-title" className="font-bold text-stone-900 dark:text-stone-50">POS shortcuts</h2>
              <button
                type="button"
                className="text-sm font-semibold text-stone-500 focus-visible:ring-2 focus-visible:ring-brand-500"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-stone-700 dark:text-stone-200">
              <li><kbd className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs">/</kbd> or <kbd className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs">F2</kbd> — Focus search</li>
              <li><kbd className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs">F9</kbd> — Charge (when enabled)</li>
              <li><kbd className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs">Esc</kbd> — Close sheets</li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
