"use client";

import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

/** Standard admin page root — spacing + overflow */
export function AdminPage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`min-w-0 w-full space-y-5 ${className}`}>{children}</div>;
}

const KPI_ACCENTS = {
  brand: "bg-brand-50 text-brand-700 ring-brand-100 dark:bg-brand-950/40 dark:text-brand-300 dark:ring-brand-900/50",
  orange: "bg-orange-50 text-orange-700 ring-orange-100 dark:bg-orange-950/40 dark:text-orange-300 dark:ring-orange-900/50",
  sky: "bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900/50",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/50",
  violet: "bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900/50",
  amber: "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/50",
};

const ICON_GRADIENTS = {
  brand: "from-brand-500 to-orange-600",
  sky: "from-sky-500 to-blue-600",
  violet: "from-violet-500 to-purple-600",
  emerald: "from-emerald-500 to-teal-600",
  stone: "from-stone-600 to-stone-800",
};

export function AdminPageHeader({
  title,
  description,
  icon: Icon,
  iconAccent = "brand",
  actions,
  trailing,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  iconAccent?: keyof typeof ICON_GRADIENTS;
  actions?: ReactNode;
  trailing?: ReactNode;
}) {
  const grad = ICON_GRADIENTS[iconAccent];
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${grad} text-white shadow-md`}
          >
            <Icon size={20} aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl font-bold text-stone-900 dark:text-stone-50">
            {title}
            {trailing}
          </h1>
          {description && (
            <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">{description}</p>
          )}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function AdminAlert({
  children,
  variant = "info",
}: {
  children: ReactNode;
  variant?: "info" | "success" | "error" | "warning" | "neutral";
}) {
  const styles = {
    info: "border-stone-200 bg-white text-stone-700 shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
    error: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200",
    warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
    neutral: "border-stone-200 bg-stone-50 text-stone-700 dark:border-stone-700 dark:bg-stone-800/50 dark:text-stone-300",
  };
  return (
    <p className={`rounded-xl border px-4 py-3 text-sm ${styles[variant]}`}>{children}</p>
  );
}

export function AdminKpiGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-4 ${className}`}>{children}</div>;
}

export function AdminKpiCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "brand",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  accent?: keyof typeof KPI_ACCENTS;
}) {
  return (
    <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-stone-500 dark:text-stone-400">{label}</p>
          <p className="mt-1 text-2xl font-bold text-stone-900 dark:text-stone-50">{value}</p>
          {hint && <p className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">{hint}</p>}
        </div>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ${KPI_ACCENTS[accent]}`}>
          <Icon size={18} aria-hidden />
        </span>
      </div>
    </div>
  );
}

/** Filters / search row — matches inventory stock tab */
export function AdminFilterBar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`grid gap-3 rounded-2xl border border-stone-200/80 bg-stone-50/50 p-3 dark:border-stone-700 dark:bg-stone-800/30 ${className}`}
    >
      {children}
    </div>
  );
}

/** Table or list container */
export function AdminSurface({
  children,
  className = "",
  padding = true,
}: {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-stone-200/80 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-900 ${
        padding ? "p-4" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

/** Section with title bar — inventory / settings style */
export function AdminPanel({
  title,
  description,
  children,
  className = "",
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border border-stone-200/80 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-900 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-4 py-3 dark:border-stone-800">
        <h2 className="font-display text-base font-bold text-stone-900 dark:text-stone-50">{title}</h2>
        {description ? (
          <p className="w-full text-xs text-stone-500 dark:text-stone-400 sm:ml-auto sm:w-auto">{description}</p>
        ) : null}
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function AdminEmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className = "",
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Smaller padding — use inside cards/panels */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-dashed border-stone-200 bg-stone-50/30 text-center dark:border-stone-700 dark:bg-stone-800/20 ${
        compact ? "px-4 py-8" : "py-16"
      } ${className}`}
    >
      <Icon
        size={compact ? 28 : 36}
        className="mx-auto text-stone-300 dark:text-stone-600"
        aria-hidden
      />
      <p className={`font-medium text-stone-600 dark:text-stone-400 ${compact ? "mt-2 text-sm" : "mt-3"}`}>
        {title}
      </p>
      {description && (
        <p className={`text-stone-400 dark:text-stone-500 ${compact ? "mt-1 text-xs" : "mt-1 text-sm"}`}>
          {description}
        </p>
      )}
      {action && <div className={compact ? "mt-3" : "mt-4"}>{action}</div>}
    </div>
  );
}
