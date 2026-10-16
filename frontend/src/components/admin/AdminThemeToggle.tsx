"use client";

import { Moon, Sun } from "lucide-react";
import type { AdminTheme } from "@/lib/admin-theme";

export function AdminThemeToggle({
  theme,
  onToggle,
  className = "",
  showLabel = false,
}: {
  theme: AdminTheme;
  onToggle: () => void;
  className?: string;
  showLabel?: boolean;
}) {
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 shadow-sm transition hover:border-brand-200 hover:text-brand-700 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200 dark:hover:border-stone-500 dark:hover:text-white ${
        showLabel ? "gap-2 px-3 py-2 text-sm font-semibold" : "h-9 w-9"
      } ${className}`}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light mode" : "Dark mode"}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
      {showLabel && <span className="hidden sm:inline">{dark ? "Light" : "Dark"}</span>}
    </button>
  );
}
