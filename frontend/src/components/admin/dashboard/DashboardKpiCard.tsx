"use client";

import type { LucideIcon } from "lucide-react";
import { DashboardKpiSparkline } from "./DashboardKpiSparkline";

const ACCENT_BAR = {
  brand: "bg-brand-500",
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
} as const;

const ACCENT_ICON = {
  brand: "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950/50 dark:text-brand-300",
  sky: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  violet: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300",
  amber: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
} as const;

export function DashboardKpiCard({
  label,
  value,
  hint,
  title,
  icon: Icon,
  accent = "brand",
  sparklineHours,
}: {
  label: string;
  value: string | number;
  hint?: string;
  title?: string;
  icon: LucideIcon;
  accent?: keyof typeof ACCENT_BAR;
  sparklineHours?: { hour: number; orders: number }[];
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-stone-200/70 bg-white p-4 shadow-sm dark:border-stone-700/80 dark:bg-stone-900/90 sm:p-5"
      title={title}
    >
      <div className={`absolute left-0 top-0 h-full w-1 ${ACCENT_BAR[accent]}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-stone-500 dark:text-stone-400">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:text-[1.65rem]">
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">{hint}</p>}
          {sparklineHours && sparklineHours.length > 0 && (
            <div className="mt-2 hidden max-w-[140px] motion-reduce:hidden min-[400px]:block">
              <DashboardKpiSparkline hours={sparklineHours} className="opacity-90" />
            </div>
          )}
        </div>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${ACCENT_ICON[accent]}`}>
          <Icon size={18} aria-hidden />
        </div>
      </div>
    </div>
  );
}
