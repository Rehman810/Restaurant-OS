"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";

type Props = {
  categories: string[];
  category: string;
  onCategoryChange: (cat: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  counts: Record<string, number>;
  totalCount: number;
};

export function MenuFilters({
  categories,
  category,
  onCategoryChange,
  search,
  onSearchChange,
  counts,
  totalCount,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);

  const chips = useMemo(() => ["All", ...categories], [categories]);

  function updateScrollHints() {
    const el = railRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    updateScrollHints();
    const el = railRef.current;
    if (!el) return;
    const onScroll = () => updateScrollHints();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(updateScrollHints);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [chips.length]);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const active = el.querySelector<HTMLButtonElement>(`[data-cat="${category}"]`);
    if (!active) return;
    const left = active.offsetLeft - 12;
    const right = left + active.offsetWidth + 24;
    if (left < el.scrollLeft) el.scrollTo({ left, behavior: "smooth" });
    else if (right > el.scrollLeft + el.clientWidth) {
      el.scrollTo({ left: right - el.clientWidth, behavior: "smooth" });
    }
  }, [category]);

  function scrollRail(dir: -1 | 1) {
    railRef.current?.scrollBy({ left: dir * 220, behavior: "smooth" });
  }

  return (
    <div className="sticky top-16 z-30 -mx-4 border-b border-orange-100/70 bg-[#fffaf5]/95 px-4 py-4 backdrop-blur-md sm:top-[72px] sm:-mx-6 sm:px-6">
      <div
        className={`flex h-12 items-center gap-3 rounded-2xl border bg-white px-4 shadow-sm transition-all ${
          focused
            ? "border-brand-400 shadow-[0_0_0_4px_rgba(234,88,12,0.12)]"
            : "border-orange-200/80"
        }`}
      >
        <Search size={18} className={`shrink-0 ${focused || search ? "text-brand-500" : "text-stone-400"}`} />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search menu…"
          aria-label="Search menu"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-stone-900 outline-none placeholder:font-normal placeholder:text-stone-400"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-stone-100 text-stone-500 transition hover:bg-stone-200"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="relative mt-3">
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollRail(-1)}
            className="absolute left-0 top-1/2 z-20 hidden h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-orange-100 bg-white text-stone-600 shadow-md transition hover:bg-brand-50 sm:grid"
            aria-label="Scroll categories left"
          >
            <ChevronLeft size={16} />
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollRail(1)}
            className="absolute right-0 top-1/2 z-20 hidden h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-orange-100 bg-white text-stone-600 shadow-md transition hover:bg-brand-50 sm:grid"
            aria-label="Scroll categories right"
          >
            <ChevronRight size={16} />
          </button>
        )}

        {canScrollLeft && (
          <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-10 bg-gradient-to-r from-[#fffaf5] to-transparent sm:w-12" />
        )}
        {canScrollRight && (
          <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-10 bg-gradient-to-l from-[#fffaf5] to-transparent sm:w-12" />
        )}

        <div
          ref={railRef}
          className="flex gap-2 overflow-x-auto scroll-smooth pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {chips.map((c) => {
            const active = category === c;
            const count = c === "All" ? totalCount : counts[c] ?? 0;
            return (
              <button
                key={c}
                type="button"
                data-cat={c}
                onClick={() => onCategoryChange(c)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all ${
                  active
                    ? "bg-brand-600 text-white shadow-md shadow-brand-600/25"
                    : "bg-white text-stone-600 ring-1 ring-stone-200/80 hover:bg-brand-50 hover:text-brand-800"
                }`}
              >
                <span>{c}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                    active ? "bg-white/20 text-white" : "bg-stone-100 text-stone-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
