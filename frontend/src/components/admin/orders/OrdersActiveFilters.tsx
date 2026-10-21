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
  tone = "brand",
}: {
  chips: ActiveFilterChip[];
  onRemove: (key: string) => void;
  onClearAll: () => void;
  /** Orders uses brand red; staff and other lists use neutral stone */
  tone?: "brand" | "neutral";
}) {
  if (!chips.length) return null;

  const chipClass =
    tone === "neutral"
      ? "bg-stone-100 text-stone-800 ring-stone-200 dark:bg-stone-800 dark:text-stone-100 dark:ring-stone-600"
      : "bg-brand-50 text-brand-900 ring-brand-200 dark:bg-brand-950/40 dark:text-brand-100 dark:ring-brand-800";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onRemove(c.key)}
          className={`inline-flex min-h-[36px] items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${chipClass}`}
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
