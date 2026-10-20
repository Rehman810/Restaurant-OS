"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type PanelAccent = "orange" | "teal" | "violet" | "slate";

const ACCENT_BG: Record<PanelAccent, string> = {
  orange: "from-orange-500/12 via-transparent to-amber-400/5",
  teal: "from-teal-500/12 via-transparent to-cyan-400/5",
  violet: "from-violet-500/12 via-transparent to-indigo-400/5",
  slate: "from-stone-400/10 via-transparent to-stone-500/5",
};

const ICON_GRADIENT: Record<PanelAccent, string> = {
  orange: "from-orange-500 to-amber-700 shadow-orange-500/30",
  teal: "from-teal-500 to-emerald-700 shadow-teal-500/30",
  violet: "from-violet-500 to-indigo-700 shadow-violet-500/30",
  slate: "from-stone-600 to-stone-800 shadow-stone-500/20",
};

export function AnalyticsChartPanel({
  title,
  subtitle,
  icon: Icon,
  accent = "orange",
  children,
  className = "",
  headerExtra,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  accent?: PanelAccent;
  children: ReactNode;
  className?: string;
  headerExtra?: ReactNode;
  compact?: boolean;
}) {
  return (
    <section
      className={`group relative overflow-hidden rounded-3xl border border-stone-200/70 bg-white/90 shadow-[0_12px_48px_-16px_rgba(28,25,23,0.18)] backdrop-blur-sm transition-shadow hover:shadow-[0_16px_56px_-14px_rgba(234,88,12,0.12)] dark:border-stone-700/80 dark:bg-stone-900/85 dark:shadow-[0_12px_48px_-16px_rgba(0,0,0,0.5)] ${
        compact ? "rounded-2xl p-4 shadow-md sm:p-4" : "p-5 sm:p-6"
      } ${className}`}
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${ACCENT_BG[accent]} opacity-100 transition-opacity group-hover:opacity-100`}
      />
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-orange-400/10 blur-3xl dark:bg-orange-500/5" />
      <div className="relative">
        <div className={`flex flex-wrap items-start justify-between gap-2 ${compact ? "mb-3" : "mb-5 gap-3"}`}>
          <div className="flex min-w-0 items-start gap-2.5">
            {Icon && (
              <div
                className={`flex shrink-0 rounded-xl bg-gradient-to-br text-white shadow-lg ${ICON_GRADIENT[accent]} ${
                  compact ? "p-2" : "rounded-2xl p-2.5"
                }`}
              >
                <Icon size={compact ? 16 : 20} strokeWidth={2.25} aria-hidden />
              </div>
            )}
            <div className="min-w-0">
              <h2
                className={`font-display font-bold tracking-tight text-stone-900 dark:text-stone-50 ${
                  compact ? "text-base" : "text-lg sm:text-xl"
                }`}
              >
                {title}
              </h2>
              {subtitle && (
                <p className={`mt-0.5 text-stone-500 dark:text-stone-400 ${compact ? "text-xs leading-snug" : "text-sm"}`}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {headerExtra}
        </div>
        {children}
      </div>
    </section>
  );
}

export function AnalyticsHero({
  title,
  subtitle,
  highlight,
  chips,
}: {
  title: string;
  subtitle: string;
  highlight?: { label: string; value: string };
  chips?: ReactNode;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#3a2a1f] via-stone-900 to-[#14100d] px-5 py-6 text-white shadow-xl sm:px-8 sm:py-7"
    >
      <div className="pointer-events-none absolute -right-24 -top-20 h-80 w-80 rounded-full bg-orange-500/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 left-1/4 h-64 w-64 rounded-full bg-amber-600/20 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(251,146,60,0.15),_transparent_55%)]" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-300/90">Performance insights</p>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          <p className="max-w-2xl text-sm text-stone-300 sm:text-base">{subtitle}</p>
          {chips && <div className="flex flex-wrap gap-2 pt-1">{chips}</div>}
        </div>
        {highlight && (
          <div className="shrink-0 rounded-2xl border border-white/10 bg-black/30 px-5 py-4 backdrop-blur-md ring-1 ring-white/10">
            <p className="text-xs font-medium uppercase tracking-wider text-stone-400">{highlight.label}</p>
            <p className="mt-1 font-display text-3xl font-bold text-white sm:text-4xl">{highlight.value}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function AnalyticsSegControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-2xl border border-stone-200/80 bg-stone-100/80 p-1 dark:border-stone-600 dark:bg-stone-800/80">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`min-h-9 rounded-xl font-bold transition-all ${pad} ${
            value === o.id
              ? "bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md shadow-orange-500/25"
              : "text-stone-600 hover:bg-white/60 dark:text-stone-300 dark:hover:bg-stone-700/60"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function AnalyticsFilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold transition-all ${
        active
          ? "bg-gradient-to-r from-stone-900 to-stone-800 text-white shadow-lg shadow-stone-900/20 dark:from-stone-100 dark:to-stone-200 dark:text-stone-900"
          : "bg-white/80 text-stone-600 ring-1 ring-stone-200/80 hover:ring-orange-200 dark:bg-stone-800/80 dark:text-stone-300 dark:ring-stone-600"
      }`}
    >
      {children}
    </button>
  );
}

export function AnalyticsInsightCard({
  title,
  body,
  variant = "default",
}: {
  title: string;
  body: string;
  variant?: "default" | "highlight";
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-4 text-sm ring-1 ${
        variant === "highlight"
          ? "bg-gradient-to-br from-orange-50 to-amber-50/80 ring-orange-200/60 dark:from-orange-950/40 dark:to-stone-900 dark:ring-orange-900/50"
          : "bg-white/90 ring-stone-200/70 dark:bg-stone-900/90 dark:ring-stone-700"
      }`}
    >
      {variant === "highlight" && (
        <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-orange-400/20 blur-2xl" />
      )}
      <p className="relative font-display font-bold text-stone-900 dark:text-stone-100">{title}</p>
      <p className="relative mt-1.5 leading-relaxed text-stone-600 dark:text-stone-400">{body}</p>
    </div>
  );
}

export function AnalyticsKpiCard({
  label,
  value,
  delta,
  invert,
  help,
  accent = "orange",
  showComparison = true,
}: {
  label: string;
  value: string;
  delta: { text: string; direction: "up" | "down" | "neutral" };
  invert?: boolean;
  help?: string;
  accent?: PanelAccent;
  showComparison?: boolean;
}) {
  const good =
    delta.direction === "neutral"
      ? "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400"
      : (delta.direction === "up" && !invert) || (delta.direction === "down" && invert)
        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
        : "bg-red-500/10 text-red-700 dark:text-red-400";

  const topBar: Record<PanelAccent, string> = {
    orange: "from-orange-500 via-amber-500 to-orange-600",
    teal: "from-teal-500 to-emerald-500",
    violet: "from-violet-500 to-indigo-500",
    slate: "from-stone-500 to-stone-600",
  };

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-stone-200/60 bg-white/95 p-4 shadow-sm dark:border-stone-700/80 dark:bg-stone-900/95"
      title={help}
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${topBar[accent]}`} />
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50">{value}</p>
      {showComparison ? (
        <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${good}`}>
          {delta.text} vs prior
        </span>
      ) : (
        <span className="mt-3 inline-flex rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-500 dark:bg-stone-800 dark:text-stone-400">
          Comparison off
        </span>
      )}
    </div>
  );
}

export function ChartEmpty({ message = "No data yet for this period." }: { message?: string }) {
  return (
    <div className="flex min-h-[160px] flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-stone-50/50 px-4 py-8 text-center dark:border-stone-700 dark:bg-stone-800/30">
      <p className="text-sm font-medium text-stone-500 dark:text-stone-400">{message}</p>
    </div>
  );
}
