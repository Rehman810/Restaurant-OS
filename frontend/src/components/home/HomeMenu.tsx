"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { fetchAllCategories, fetchAllMenuItems } from "@/lib/catalog-api";
import { MenuItemCard } from "@/components/MenuItemCard";
import { CATEGORIES as DEFAULT_CATEGORIES, Category, MenuItem } from "@/lib/types";
import { DEFAULT_CATEGORY_BANNER, enrichCategories } from "@/lib/category-meta";

function slug(cat: string) {
  return cat.toLowerCase().replace(/\s+/g, "-");
}

function matchesSearch(item: MenuItem, q: string) {
  const hay = `${item.name} ${item.description ?? ""} ${item.category}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}

export function HomeMenu() {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q")?.trim() ?? "";
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [categories, setCategories] = useState<Category[]>(
    enrichCategories(
      DEFAULT_CATEGORIES.map((name, i) => ({
        id: `default-${i}`,
        name,
        tagline: "",
        imageUrl: "",
        sortOrder: i + 1,
        createdAt: "",
      }))
    )
  );
  const [error, setError] = useState("");
  const [active, setActive] = useState("All");
  useEffect(() => {
    Promise.all([
      fetchAllMenuItems(),
      fetchAllCategories().catch(() => []),
    ])
      .then(([menu, cats]) => {
        setItems(menu);
        if (cats.length > 0) setCategories(enrichCategories(cats));
      })
      .catch((e) => setError(e.message));
  }, []);

  const searchResults = useMemo(() => {
    if (!items || !searchQuery) return [];
    return items.filter((item) => matchesSearch(item, searchQuery));
  }, [items, searchQuery]);

  const grouped = useMemo(() => {
    if (!items) return {};
    const map: Record<string, MenuItem[]> = {};
    for (const c of categories) map[c.name] = [];
    for (const item of items) {
      if (searchQuery && !matchesSearch(item, searchQuery)) continue;
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item);
    }
    return map;
  }, [items, categories, searchQuery]);

  const scrollTo = (cat: string) => {
    setActive(cat);
    if (cat === "All") {
      document.getElementById("menu-start")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    document.getElementById(`cat-${slug(cat)}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section id="menu-start" className="scroll-mt-24 bg-[#fffaf5] py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-brand-600">Order from the pass</p>
            <h2 className="font-display mt-2 text-4xl text-ink sm:text-5xl">Our menu</h2>
            <p className="mt-2 max-w-lg text-stone-600">
              {searchQuery
                ? `Showing results for “${searchQuery}”.`
                : "Fresh off the grill, straight to your door. Tap a category or scroll through everything."}
            </p>
          </div>
          <Link href="/menu" className="btn-ghost shrink-0 self-start sm:self-auto">
            Full menu <ArrowRight size={16} />
          </Link>
        </div>

        <div className="sticky top-16 z-30 -mx-4 mt-8 border-b border-orange-100 bg-[#fffaf5]/95 px-4 py-3 backdrop-blur-md sm:top-[72px] sm:-mx-6 sm:px-6">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {["All", ...categories.map((c) => c.name)].map((c) => (
              <button
                key={c}
                onClick={() => scrollTo(c)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                  active === c
                    ? "bg-brand-600 text-white shadow-card scale-105"
                    : "bg-white text-stone-600 hover:bg-brand-50"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="mt-8 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load menu — is the backend running? ({error})
          </p>
        )}

        {!items && !error && (
          <div className="mt-10 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-[7.5rem]" />
            ))}
          </div>
        )}

        {items && searchQuery && searchResults.length === 0 && (
          <p className="mt-10 rounded-2xl bg-white px-4 py-8 text-center text-sm text-stone-500 shadow-card">
            No dishes found for “{searchQuery}”. Try another search or browse categories below.
          </p>
        )}

        {items && (
          <div className="mt-10 space-y-16 sm:space-y-20">
            {categories.map((cat) => {
              const list = grouped[cat.name] || [];
              if (!list.length) return null;
              const banner = cat.imageUrl || DEFAULT_CATEGORY_BANNER;
              const tagline = cat.tagline || cat.name;
              return (
                <div key={cat.id} id={`cat-${slug(cat.name)}`} className="scroll-mt-36">
                  <div className="mb-4 sm:hidden">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-600">{tagline}</p>
                    <h3 className="font-display text-2xl text-stone-900">{cat.name}</h3>
                    <p className="mt-0.5 text-xs text-stone-500">{list.length} items</p>
                  </div>
                  <div className="relative mb-6 hidden overflow-hidden rounded-3xl sm:block">
                    <div className="relative h-44">
                      <Image src={banner} alt="" fill className="object-cover" sizes="100vw" />
                      <div className="absolute inset-0 bg-gradient-to-r from-stone-950/80 via-stone-950/50 to-transparent" />
                      <div className="absolute inset-0 flex flex-col justify-end p-7">
                        <p className="text-xs font-bold uppercase tracking-widest text-brand-300">{tagline}</p>
                        <h3 className="font-display text-4xl text-white">{cat.name}</h3>
                        <p className="mt-1 text-sm text-orange-100">{list.length} items</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
                    {list.map((item) => (
                      <MenuItemCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
