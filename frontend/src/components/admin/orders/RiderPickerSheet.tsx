"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Rider } from "@/lib/admin-types";

export function RiderPickerSheet({
  open,
  title,
  riders,
  onClose,
  onSelect,
}: {
  open: boolean;
  title: string;
  riders: Rider[];
  onClose: () => void;
  onSelect: (riderId: string) => void;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = !needle
      ? riders
      : riders.filter(
          (r) =>
            r.name.toLowerCase().includes(needle) ||
            (r.phone && r.phone.includes(needle))
        );
    return [...list].sort(
      (a, b) => (a.activeDeliveries ?? 0) - (b.activeDeliveries ?? 0)
    );
  }, [q, riders]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-stone-950/50 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-3xl border border-stone-200 bg-white shadow-xl dark:border-stone-600 dark:bg-stone-900"
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4 dark:border-stone-700">
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-50">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            className="grid h-10 w-10 place-items-center rounded-full border border-stone-200 dark:border-stone-600"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              className="input w-full min-h-[44px] pl-10"
              placeholder="Search rider…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {filtered.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="flex w-full min-h-[48px] items-center justify-between rounded-xl px-3 py-3 text-left hover:bg-stone-50 dark:hover:bg-stone-800"
                onClick={() => onSelect(r.id)}
              >
                <span className="font-semibold text-stone-900 dark:text-stone-100">{r.name}</span>
                <span className="text-xs font-medium text-stone-500">
                  {r.activeDeliveries ?? 0} active
                </span>
              </button>
            </li>
          ))}
          {!filtered.length && (
            <p className="px-3 py-6 text-center text-sm text-stone-500">No riders match.</p>
          )}
        </ul>
      </div>
    </div>
  );
}
