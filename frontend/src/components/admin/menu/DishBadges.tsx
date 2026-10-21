"use client";

import type { AdminDishRow } from "@/lib/admin-menu/types";

export function DishBadges({
  row,
  showMargin,
  recipeCostFlag,
}: {
  row: AdminDishRow;
  showMargin?: boolean;
  recipeCostFlag?: "NO_RECIPE" | "INCOMPLETE" | "SUSPICIOUS_LOW" | null;
}) {
  const margin =
    showMargin && row.marginPercent != null
      ? row.marginPercent >= 40
        ? "healthy"
        : row.marginPercent >= 20
          ? "low"
          : "low"
      : showMargin && !row.costKnown
        ? "unknown"
        : null;

  return (
    <div className="flex flex-wrap gap-1">
      {row.optionGroupCount > 0 && (
        <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] font-semibold text-stone-700 dark:bg-stone-800 dark:text-stone-300">
          Options ({row.optionGroupCount})
        </span>
      )}
      {row.allergens.slice(0, 3).map((a) => (
        <span
          key={a}
          className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-100"
        >
          {a}
        </span>
      ))}
      {row.station && (
        <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[11px] font-semibold text-sky-900 dark:bg-sky-950/50 dark:text-sky-100">
          {row.station.name}
        </span>
      )}
      {margin === "healthy" && (
        <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/50">
          Margin healthy
        </span>
      )}
      {margin === "low" && row.marginPercent != null && (
        <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-950/50">
          Low margin
        </span>
      )}
      {margin === "unknown" && (
        <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] font-semibold text-stone-600 dark:bg-stone-800">
          Cost unknown
        </span>
      )}
      {recipeCostFlag && (
        <a
          href="/admin/reports/dish-costing?status=needs_check"
          className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900 underline-offset-2 hover:underline dark:bg-amber-950/50 dark:text-amber-100"
        >
          Check recipe
        </a>
      )}
    </div>
  );
}
