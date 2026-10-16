"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { MENU_SEARCH_SUGGESTIONS } from "@/lib/storefront-copy";

const SUGGESTIONS = MENU_SEARCH_SUGGESTIONS;

export function HeroSearchInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q")?.trim() ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [focused, setFocused] = useState(false);
  const [idx, setIdx] = useState(0);
  const showAnimated = !query && !focused;

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    if (!showAnimated) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % SUGGESTIONS.length), 2800);
    return () => clearInterval(t);
  }, [showAnimated]);

  const clearSearch = () => {
    router.replace("/", { scroll: false });
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) {
      clearSearch();
      return;
    }
    router.push(`/?q=${encodeURIComponent(q)}#menu-start`);
    requestAnimationFrame(() => {
      document.getElementById("menu-start")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleChange = (value: string) => {
    setQuery(value);
    if (!value.trim()) clearSearch();
  };

  return (
    <form onSubmit={submit} className="relative w-full">
      <div
        className={`flex h-11 items-center gap-2.5 rounded-full border px-4 transition-all duration-300 ${
          focused
            ? "border-brand-400 bg-white shadow-[0_0_0_4px_color-mix(in_srgb,var(--brand-500)_14%,transparent)]"
            : "border-brand-200 bg-[var(--brand-surface)] shadow-sm"
        }`}
      >
        <Search
          size={17}
          className={`shrink-0 transition-colors ${focused || showAnimated ? "text-brand-500" : "text-stone-400"}`}
        />
        <div className="relative min-w-0 flex-1">
          <input
            type="search"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="w-full bg-transparent text-sm font-medium text-stone-900 outline-none"
            aria-label="Search menu"
          />
          {showAnimated && (
            <span
              key={idx}
              className="pointer-events-none absolute inset-0 flex items-center text-sm text-stone-400 hero-search-hint"
              aria-hidden
            >
              Search for {SUGGESTIONS[idx]}…
            </span>
          )}
        </div>
      </div>
    </form>
  );
}
