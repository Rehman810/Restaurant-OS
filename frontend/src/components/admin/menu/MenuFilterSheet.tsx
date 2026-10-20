"use client";

import { ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";

type Props = {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  label: string;
  title?: string;
  children: ReactNode;
};

export function MenuFilterSheet({ open, onOpen, onClose, label, title = "Filters", children }: Props) {
  return (
    <>
      <div className="lg:hidden">
        <button
          type="button"
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold text-stone-800 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
          onClick={onOpen}
          aria-expanded={open}
          aria-controls="menu-mobile-filters"
        >
          <SlidersHorizontal size={16} aria-hidden />
          {label}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[90] lg:hidden" role="presentation">
          <button type="button" className="absolute inset-0 bg-stone-950/50" aria-label="Close filters" onClick={onClose} />
          <div
            id="menu-mobile-filters"
            role="dialog"
            aria-modal="true"
            aria-labelledby="menu-filter-sheet-title"
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 id="menu-filter-sheet-title" className="text-lg font-semibold text-stone-900 dark:text-stone-50">
                {title}
              </h2>
              <button
                type="button"
                aria-label="Close"
                className="grid h-11 w-11 place-items-center rounded-full border border-stone-200 dark:border-stone-600"
                onClick={onClose}
              >
                <X size={18} />
              </button>
            </div>
            {children}
          </div>
        </div>
      )}
    </>
  );
}
