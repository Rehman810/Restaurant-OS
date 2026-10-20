"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  page: number;
  totalPages: number;
  totalItems: number;
  rangeStart: number;
  rangeEnd: number;
  onPageChange: (page: number) => void;
  className?: string;
  docked?: boolean;
};

export function Pagination({
  page,
  totalPages,
  totalItems,
  rangeStart,
  rangeEnd,
  onPageChange,
  className = "",
  docked = false,
}: Props) {
  if (totalItems === 0) return null;

  return (
    <nav
      className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${
        docked
          ? "px-0 py-3"
          : "rounded-2xl border border-stone-200/80 bg-white px-4 py-3 shadow-sm"
      } ${className}`}
      aria-label="Pagination"
    >
      <p className="text-xs font-medium text-stone-500">
        Showing <span className="text-stone-800">{rangeStart}–{rangeEnd}</span> of{" "}
        <span className="text-stone-800">{totalItems}</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={14} /> Previous
        </button>
        <span className="min-w-[5.5rem] text-center text-xs font-semibold text-stone-600">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next <ChevronRight size={14} />
        </button>
      </div>
    </nav>
  );
}
