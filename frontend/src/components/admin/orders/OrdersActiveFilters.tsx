"use client";

import { X } from "lucide-react";

export type ActiveFilterChip = {
  key: string;
  label: string;
};

export function OrdersActiveFilters({
  chips,
  onRemove,
  onClearAll,
}: {
  chips: ActiveFilterChip[];
  onRemove: (key: string) => void;
  onClearAll: () => void;
}) {
  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onRemove(c.key)}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-900 ring-1 ring-brand-200 dark:bg-brand-950/40 dark:text-brand-100 dark:ring-brand-800"
        >
          {c.label}
          <X size={12} aria-hidden />
        </button>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="text-xs font-bold text-stone-600 underline-offset-2 hover:underline dark:text-stone-300"
      >
        Clear all
      </button>
    </div>
  );
}
