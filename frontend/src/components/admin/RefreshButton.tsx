"use client";

import { RefreshCw } from "lucide-react";

export function RefreshButton({
  busy,
  onClick,
  className = "",
  variant = "ghost",
  showLabel = true,
  label = "Refresh",
  compact = false,
  updatedAt,
}: {
  busy?: boolean;
  onClick: () => void;
  className?: string;
  variant?: "ghost" | "primary" | "dark";
  showLabel?: boolean;
  label?: string;
  compact?: boolean;
  updatedAt?: Date | null;
}) {
  const updatedLabel = updatedAt
    ? `Updated ${updatedAt.toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit" })}`
    : null;

  const styles = {
    ghost:
      "inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-white disabled:opacity-60",
    primary:
      "inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-500 disabled:opacity-60",
    dark:
      "inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-5 py-4 text-sm font-bold text-white shadow-lg shadow-brand-900/40 hover:bg-brand-500 disabled:opacity-60",
  };

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        {updatedLabel && (
          <span className="hidden text-xs text-stone-500 dark:text-stone-400 sm:inline">{updatedLabel}</span>
        )}
        <button
          type="button"
          onClick={onClick}
          disabled={busy}
          aria-label={label}
          className="inline-flex h-11 min-h-[44px] w-11 min-w-[44px] items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-200"
        >
          <RefreshCw size={18} className={busy ? "animate-spin" : ""} />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={showLabel ? undefined : label}
      className={`${styles[variant]} ${showLabel ? "" : "!px-2.5 !py-2.5"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${className}`}
    >
      <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
      {showLabel ? label : null}
    </button>
  );
}
