"use client";

import { LayoutGrid, Table2 } from "lucide-react";

export type CatalogView = "grid" | "list";

export function CatalogViewToggle({
  value,
  onChange,
}: {
  value: CatalogView;
  onChange: (view: CatalogView) => void;
}) {
  return (
    <div className="flex rounded-xl border border-stone-200 bg-white p-0.5 dark:border-stone-600 dark:bg-stone-900">
      {(
        [
          { id: "list" as const, icon: Table2, label: "Table" },
          { id: "grid" as const, icon: LayoutGrid, label: "Grid" },
        ] as const
      ).map((v) => (
        <button
          key={v.id}
          type="button"
          aria-label={v.label}
          aria-pressed={value === v.id}
          onClick={() => onChange(v.id)}
          className={`grid h-10 w-10 place-items-center rounded-lg ${
            value === v.id ? "bg-brand-600 text-white" : "text-stone-600 dark:text-stone-300"
          }`}
        >
          <v.icon size={16} />
        </button>
      ))}
    </div>
  );
}

export function parseCatalogView(raw: string | null, fallback: CatalogView = "grid"): CatalogView {
  if (raw === "list" || raw === "grid") return raw;
  return fallback;
}
