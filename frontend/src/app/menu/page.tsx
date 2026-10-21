"use client";

import { useEffect, useMemo, useState } from "react";
import { StoreShell } from "@/components/StoreShell";
import { MenuCard } from "@/components/MenuCard";
import { MenuFilters } from "@/components/MenuFilters";
import { fetchAllCategories, fetchAllMenuItems } from "@/lib/catalog-api";
import { PAGE_SIZE } from "@/lib/pagination";
import { usePagination } from "@/hooks/usePagination";
import { Pagination } from "@/components/Pagination";
import { MENU_EMPTY_HINT } from "@/lib/storefront-copy";
import { CATEGORIES as DEFAULT_CATEGORIES, Category, MenuItem } from "@/lib/types";
import { useMenuRealtimeRefresh } from "@/hooks/useMenuRealtimeRefresh";

export default function MenuPage() {
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [categories, setCategories] = useState<string[]>([...DEFAULT_CATEGORIES]);
  const [cat, setCat] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  function loadCatalog() {
    Promise.all([
      fetchAllMenuItems(),
      fetchAllCategories().catch((): Category[] => []),
    ])
      .then(([menu, cats]) => {
        setItems(menu);
        if (cats.length > 0) setCategories(cats.map((c) => c.name));
      })
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    loadCatalog();
  }, []);

  useMenuRealtimeRefresh(loadCatalog);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items ?? []) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return counts;
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const sorted = [...items].sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    let list = cat === "All" ? sorted : sorted.filter((i) => i.category === cat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, cat, search]);

  const menuPagination = usePagination(filtered, PAGE_SIZE.grid, `${cat}|${search}`);

  const subtitle = search.trim()
    ? `${filtered.length} result${filtered.length === 1 ? "" : "s"} for “${search.trim()}”`
    : cat === "All"
      ? `${filtered.length} dishes across all categories`
      : `${filtered.length} in ${cat}`;

  return (
    <StoreShell>
      <div className="mx-auto max-w-6xl px-4 pb-28 pt-8 sm:px-6 sm:pb-20 sm:pt-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-brand-600">Full menu</p>
            <h1 className="font-display mt-2 text-4xl text-stone-900 sm:text-5xl">What are you craving?</h1>
          </div>
          {items && (
            <p className="text-sm font-medium text-stone-500 sm:text-right">{subtitle}</p>
          )}
        </div>

        <MenuFilters
          categories={categories}
          category={cat}
          onCategoryChange={setCat}
          search={search}
          onSearchChange={setSearch}
          counts={categoryCounts}
          totalCount={items?.length ?? 0}
        />

        {error && (
          <p className="mt-8 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {!items && !error && (
          <div className="mt-8 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-[7.5rem] rounded-2xl" />
            ))}
          </div>
        )}

        {items && filtered.length === 0 && (
          <div
            className="mt-10 rounded-3xl border border-dashed bg-white px-6 py-12 text-center shadow-sm"
            style={{ borderColor: "var(--brand-surface-border)" }}
          >
            <p className="font-display text-xl text-stone-800">Nothing found</p>
            <p className="mt-2 text-sm text-stone-500">
              {MENU_EMPTY_HINT}
            </p>
            {(search || cat !== "All") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCat("All");
                }}
                className="btn-ghost mt-5"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {items && filtered.length > 0 && (
          <>
          <div className="mt-8 grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
            {menuPagination.pageItems.map((item) => (
              <MenuCard key={item.id} item={item} />
            ))}
          </div>
          <Pagination
            page={menuPagination.page}
            totalPages={menuPagination.totalPages}
            totalItems={menuPagination.totalItems}
            rangeStart={menuPagination.rangeStart}
            rangeEnd={menuPagination.rangeEnd}
            onPageChange={menuPagination.setPage}
            className="mt-8"
          />
          </>
        )}
      </div>
    </StoreShell>
  );
}
