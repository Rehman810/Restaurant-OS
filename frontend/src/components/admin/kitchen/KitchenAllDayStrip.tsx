"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import type { AllDayItemCount } from "@/lib/kitchen/helpers";

export function KitchenAllDayStrip({
  items,
  open,
  onToggle,
}: {
  items: AllDayItemCount[];
  open: boolean;
  onToggle: () => void;
}) {
  if (!items.length) return null;

  const summary = items.slice(0, 4).map((i) => `${i.name} ${i.count}`).join(" · ");

  return (
    <div className="shrink-0 rounded-xl border border-stone-200/80 bg-white dark:border-stone-700 dark:bg-stone-900">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="text-xs font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400">
          All-day prep
        </span>
        {open ? <ChevronUp size={16} className="text-stone-400" /> : <ChevronDown size={16} className="text-stone-400" />}
      </button>
      {open ? (
        <div className="flex flex-wrap gap-2 border-t border-stone-100 px-3 py-2 dark:border-stone-800">
          {items.map((i) => (
            <span
              key={i.name}
              className="rounded-lg bg-stone-100 px-2.5 py-1 text-sm font-bold text-stone-800 dark:bg-stone-800 dark:text-stone-100"
            >
              {i.name} <span className="tabular-nums text-brand-600 dark:text-brand-400">{i.count}</span>
            </span>
          ))}
        </div>
      ) : (
        <p className="truncate px-3 pb-2 text-sm text-stone-600 dark:text-stone-300">{summary}</p>
      )}
    </div>
  );
}
