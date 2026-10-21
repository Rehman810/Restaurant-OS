"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, Check, ChevronDown, Layers } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useBranch } from "@/modules/branches/BranchContext";
import type { BranchSelection } from "@/modules/branches/types";

export function BranchSwitcher({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const { branches, selection, setSelection, loading, activeBranch } = useBranch();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  if (!user || user.role === "CUSTOMER" || loading || branches.length === 0) return null;

  const canPickAll = user.role === "ADMIN";
  const label = selection === "all" ? "All branches" : activeBranch?.name ?? "Branch";
  const singleBranch = branches.length === 1 && !canPickAll;

  function pick(id: BranchSelection) {
    setSelection(id);
    close();
  }

  if (singleBranch) {
    return (
      <div className={`flex h-9 max-w-[16rem] items-center gap-1.5 rounded-xl border border-stone-200/90 bg-white/95 px-2 dark:border-stone-600 dark:bg-stone-800/95 ${className}`}>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
          <Building2 size={14} strokeWidth={2.25} />
        </span>
        <span className="min-w-0 truncate text-xs font-semibold text-stone-900 dark:text-stone-50" title={label}>
          {label}
        </span>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Branch: ${label}`}
        title={label}
        onClick={() => setOpen((v) => !v)}
        className="group flex h-9 max-w-[11rem] items-center gap-1.5 rounded-xl border border-stone-200/90 bg-white/95 py-0 pl-2 pr-1.5 shadow-sm transition hover:border-brand-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:border-stone-600 dark:bg-stone-800/95 dark:hover:border-stone-500 sm:max-w-[16rem]"
      >
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white"
        >
          {selection === "all" ? <Layers size={14} strokeWidth={2.25} /> : <Building2 size={14} strokeWidth={2.25} />}
        </span>
        <span className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-stone-900 dark:text-stone-50">
          {label}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-stone-400 transition group-hover:text-stone-600 dark:group-hover:text-stone-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Select branch"
          className="absolute right-0 z-50 mt-2 w-[min(100vw-1.5rem,17rem)] overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-1.5 shadow-xl shadow-stone-900/10 dark:border-stone-600 dark:bg-stone-900 dark:shadow-black/40"
        >
          <p className="px-2.5 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
            Branch
          </p>
          {canPickAll && (
            <button
              type="button"
              role="option"
              aria-selected={selection === "all"}
              onClick={() => pick("all")}
              className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-sm transition ${
                selection === "all"
                  ? "bg-brand-50 text-brand-900 dark:bg-brand-950/60 dark:text-brand-100"
                  : "text-stone-700 hover:bg-stone-50 dark:text-stone-200 dark:hover:bg-stone-800"
              }`}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                <Layers size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">All branches</span>
                <span className="block text-xs text-stone-500 dark:text-stone-400">Combined admin view</span>
              </span>
              {selection === "all" && <Check size={18} className="shrink-0 text-brand-600 dark:text-brand-400" />}
            </button>
          )}
          {branches.map((b) => {
            const selected = selection === b.id;
            return (
              <button
                key={b.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => pick(b.id)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-sm transition ${
                  selected
                    ? "bg-brand-50 text-brand-900 dark:bg-brand-950/60 dark:text-brand-100"
                    : "text-stone-700 hover:bg-stone-50 dark:text-stone-200 dark:hover:bg-stone-800"
                }`}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-stone-100 to-stone-200 text-stone-700 dark:from-stone-800 dark:to-stone-700 dark:text-stone-200">
                  <Building2 size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{b.name}</span>
                  {b.address ? (
                    <span className="block truncate text-xs text-stone-500 dark:text-stone-400">{b.address}</span>
                  ) : (
                    <span className="block text-xs text-stone-500 dark:text-stone-400">Branch</span>
                  )}
                </span>
                {selected && <Check size={18} className="shrink-0 text-brand-600 dark:text-brand-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
