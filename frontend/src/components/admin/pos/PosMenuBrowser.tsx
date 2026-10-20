"use client";

import { useMemo } from "react";
import { LayoutGrid, List } from "lucide-react";
import type { Deal, MenuItem } from "@/lib/types";
import { pkr } from "@/lib/format";
import { PosProductCard } from "@/components/admin/pos/PosProductCard";
import type { PosMenuDensity } from "@/lib/pos/menu-preferences";

type Props = {
  menu: MenuItem[];
  deals: Deal[];
  categories: string[];
  category: string;
  onCategory: (c: string) => void;
  search: string;
  density: PosMenuDensity;
  onDensity: (d: PosMenuDensity) => void;
  popularIds: string[];
  pinnedIds: string[];
  canMark86: boolean;
  canPin: boolean;
  onTapItem: (item: MenuItem) => void;
  onTapDeal: (deal: Deal) => void;
  onItemLongPress: (item: MenuItem) => void;
};

export function PosMenuBrowser({
  menu,
  deals,
  categories,
  category,
  onCategory,
  search,
  density,
  onDensity,
  popularIds,
  pinnedIds,
  canMark86,
  canPin,
  onTapItem,
  onTapDeal,
  onItemLongPress,
}: Props) {
  const filtered = useMemo(() => {
    let list = menu;
    if (category !== "All") list = list.filter((m) => m.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q));
    }
    return list;
  }, [menu, category, search]);

  const favouriteItems = useMemo(() => {
    const ids = [...new Set([...pinnedIds, ...popularIds])];
    return ids.map((id) => menu.find((m) => m.id === id)).filter(Boolean) as MenuItem[];
  }, [menu, pinnedIds, popularIds]);

  const showFavourites = category === "All" && !search.trim() && favouriteItems.length > 0;

  return (
    <>
      <div className="shrink-0 border-b border-stone-200 bg-white px-3 py-2 dark:border-stone-700 dark:bg-stone-900">
        <div className="flex items-center gap-2">
          <div
            className="relative min-w-0 flex-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{
              maskImage: "linear-gradient(to right, transparent, black 12px, black calc(100% - 12px), transparent)",
            }}
          >
            <div className="flex gap-1.5 pr-2">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onCategory(c)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold sm:px-3.5 sm:text-xs ${
                    category === c
                      ? "bg-stone-900 text-white ring-1 ring-stone-900 dark:bg-stone-100 dark:text-stone-900"
                      : "bg-white text-stone-600 ring-1 ring-stone-200 dark:bg-stone-800 dark:text-stone-300"
                  }`}
                >
                  {c}
                </button>
              ))}
              {deals.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onTapDeal(d)}
                  className="shrink-0 rounded-full bg-brand-50 px-3 py-1.5 text-[11px] font-bold text-brand-900 ring-1 ring-brand-200 dark:bg-brand-950/40 dark:text-brand-100 dark:ring-brand-800"
                >
                  {d.title} · {pkr(d.dealPrice)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 gap-1 rounded-lg bg-stone-100 p-0.5 dark:bg-stone-800">
            <button
              type="button"
              aria-label="Photo grid"
              onClick={() => onDensity("grid")}
              className={`grid h-9 w-9 place-items-center rounded-md ${density === "grid" ? "bg-white shadow-sm dark:bg-stone-700" : ""}`}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              type="button"
              aria-label="Compact list"
              onClick={() => onDensity("compact")}
              className={`grid h-9 w-9 place-items-center rounded-md ${density === "compact" ? "bg-white shadow-sm dark:bg-stone-700" : ""}`}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 pb-20 [-webkit-overflow-scrolling:touch] sm:p-3 lg:pb-3">
        {showFavourites && (
          <div className="mb-3">
            <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-widest text-stone-500">Popular &amp; pinned</p>
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {favouriteItems.map((item) => (
                <div key={`fav-${item.id}`} className="w-28 shrink-0 sm:w-32">
                  <PosProductCard
                    item={item}
                    density="grid"
                    pinned={pinnedIds.includes(item.id)}
                    canMark86={canMark86}
                    onTap={() => item.isAvailable && onTapItem(item)}
                    onLongPress={() => onItemLongPress(item)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="grid min-h-[200px] place-items-center rounded-2xl border border-dashed border-stone-300 bg-white text-center dark:border-stone-600 dark:bg-stone-900">
            <p className="text-sm font-semibold text-stone-500">No items found</p>
          </div>
        ) : density === "compact" ? (
          <div className="space-y-1.5">
            {filtered.map((item) => (
              <PosProductCard
                key={item.id}
                item={item}
                density="compact"
                pinned={pinnedIds.includes(item.id)}
                canMark86={canMark86}
                onTap={() => item.isAvailable && onTapItem(item)}
                onLongPress={() => onItemLongPress(item)}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filtered.map((item) => (
              <PosProductCard
                key={item.id}
                item={item}
                density="grid"
                pinned={pinnedIds.includes(item.id)}
                canMark86={canMark86}
                onTap={() => item.isAvailable && onTapItem(item)}
                onLongPress={() => onItemLongPress(item)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
