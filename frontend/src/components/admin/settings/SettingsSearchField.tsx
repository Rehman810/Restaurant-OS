"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { searchSettings, settingsPath } from "@/modules/settings/ia";

export function SettingsSearchField({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hits = useMemo(() => searchSettings(search), [search]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <label className="sr-only" htmlFor="settings-search">Search settings</label>
      <div className="flex min-h-11 items-center gap-2 rounded-2xl border border-stone-200 bg-white px-3 py-2 shadow-sm dark:border-stone-700 dark:bg-stone-900">
        <Search size={18} className="shrink-0 text-stone-400" aria-hidden />
        <input
          id="settings-search"
          type="search"
          className="min-w-0 flex-1 border-0 bg-transparent text-base outline-none placeholder:text-stone-400 dark:text-stone-100 sm:text-sm"
          placeholder="Search settings…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && search.trim() && hits.length > 0 && (
        <ul
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-2xl border border-stone-200 bg-white py-1 shadow-lg dark:border-stone-700 dark:bg-stone-900"
          role="listbox"
        >
          {hits.map((hit) => (
            <li key={`${hit.sectionId}-${hit.label}`}>
              <button
                type="button"
                role="option"
                className="flex w-full min-h-11 flex-col items-start justify-center px-3 py-2 text-left text-sm hover:bg-stone-50 dark:hover:bg-stone-800"
                onClick={() => {
                  setOpen(false);
                  setSearch("");
                  router.push(`${settingsPath(hit.sectionId)}#${hit.anchorId}`);
                  requestAnimationFrame(() => {
                    const el = document.getElementById(hit.anchorId);
                    el?.scrollIntoView({ behavior: "smooth", block: "center" });
                    el?.classList.add("ring-2", "ring-brand-400", "ring-offset-2");
                    window.setTimeout(() => {
                      el?.classList.remove("ring-2", "ring-brand-400", "ring-offset-2");
                    }, 2000);
                  });
                }}
              >
                <span className="font-medium text-stone-900 dark:text-stone-50">{hit.label}</span>
                <span className="text-xs text-stone-500">{hit.sectionLabel}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
