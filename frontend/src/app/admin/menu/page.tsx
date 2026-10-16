"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Eye,
  EyeOff,
  FolderPlus,
  ImageIcon,
  Layers,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { api, apiUpload, ApiError } from "@/lib/api";
import { pkr } from "@/lib/format";
import { enrichCategories } from "@/lib/category-meta";
import { mergeDealCategoryOptions, dealCategoryLabel } from "@/lib/deal-categories";
import { fetchAllCategories, fetchAllDeals, fetchAllMenuItems } from "@/lib/catalog-api";
import { PAGE_SIZE } from "@/lib/pagination";
import { usePagination } from "@/hooks/usePagination";
import { Pagination } from "@/components/Pagination";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { AdminScopeBanner } from "@/components/admin/AdminScopeBanner";
import { AdminPage, AdminPageHeader, AdminSurface, Segment } from "@/components/admin/ui";
import { ConfirmSheet } from "@/components/admin/ConfirmSheet";
import { CATEGORIES as DEFAULT_CATEGORIES, Category, Deal, MenuItem } from "@/lib/types";
import { MenuFormSheet, MenuFormData } from "@/components/admin/MenuFormSheet";
import { DealFormSheet, DealFormData } from "@/components/admin/DealFormSheet";
import { CategoryFormSheet, CategoryFormData } from "@/components/admin/CategoryFormSheet";
import { fetchPrintStations, PrintStation } from "@/lib/admin-print-stations";

type Tab = "dishes" | "deals" | "categories";
type DeleteTarget = { kind: "dish" | "deal" | "category"; id: string; label: string };

const emptyDish: MenuFormData = {
  name: "",
  description: "",
  price: "",
  discountPrice: "",
  category: "Main Course",
  imageUrl: "",
  isAvailable: true,
  optionGroups: [],
  addons: [],
  printStationId: "",
};

const emptyDeal: DealFormData = {
  title: "",
  description: "",
  category: "",
  dealPrice: "",
  imageUrl: "",
  isActive: true,
  items: [{ menuItemId: "", quantity: 1 }],
};

const emptyCategory: CategoryFormData = {
  name: "",
  tagline: "",
  imageUrl: "",
};

const CATEGORY_STYLE: Record<string, { bg: string; text: string; ring: string }> = {
  Starters: { bg: "bg-amber-50", text: "text-amber-800", ring: "ring-amber-200" },
  "Main Course": { bg: "bg-brand-50", text: "text-brand-800", ring: "ring-brand-200" },
  Beverages: { bg: "bg-sky-50", text: "text-sky-800", ring: "ring-sky-200" },
  Desserts: { bg: "bg-violet-50", text: "text-violet-800", ring: "ring-violet-200" },
};

function DishImage({ src, alt }: { src: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-stone-100 text-stone-400">
        <ImageIcon size={22} />
      </div>
    );
  }
  return (
    <Image src={src} alt={alt} fill className="object-cover" sizes="280px" onError={() => setBroken(true)} />
  );
}

export default function AdminMenu() {
  const [tab, setTab] = useState<Tab>("dishes");
  const [items, setItems] = useState<MenuItem[]>([]);
  const [printStations, setPrintStations] = useState<PrintStation[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [dishFormOpen, setDishFormOpen] = useState(false);
  const [dishForm, setDishForm] = useState<MenuFormData>(emptyDish);
  const [editingDish, setEditingDish] = useState<string | null>(null);

  const [dealCategoryFilter, setDealCategoryFilter] = useState<string>("ALL");
  const [dealFormOpen, setDealFormOpen] = useState(false);
  const [dealForm, setDealForm] = useState<DealFormData>(emptyDeal);
  const [editingDeal, setEditingDeal] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");

  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CategoryFormData>(emptyCategory);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState("");

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const categoryNames = useMemo(
    () => (categories.length > 0 ? categories.map((c) => c.name) : [...DEFAULT_CATEGORIES]),
    [categories]
  );

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setLoadError("");
    try {
      const [menu, dealList, cats, stationsRes] = await Promise.all([
        fetchAllMenuItems(),
        fetchAllDeals(),
        fetchAllCategories().catch(() => []),
        fetchPrintStations().catch(() => ({ stations: [] as PrintStation[] })),
      ]);
      setItems(menu);
      setDeals(dealList);
      setCategories(enrichCategories(cats));
      setPrintStations(stationsRes.stations);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load menu.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    let list = [...items].sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    if (catFilter !== "All") list = list.filter((i) => i.category === catFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, catFilter, search]);

  const stats = useMemo(
    () => ({
      total: items.length,
      available: items.filter((i) => i.isAvailable).length,
      outOfStock: items.filter((i) => !i.isAvailable).length,
      deals: deals.length,
      activeDeals: deals.filter((d) => d.isActive).length,
    }),
    [items, deals]
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: items.length };
    for (const c of categoryNames) counts[c] = items.filter((i) => i.category === c).length;
    return counts;
  }, [items, categoryNames]);

  const dealCategoryOptions = useMemo(
    () => mergeDealCategoryOptions(deals.map((d) => d.category)),
    [deals]
  );

  const dealFilterOptions = useMemo(() => {
    const labels = new Set(deals.map((d) => dealCategoryLabel(d.category)));
    return ["ALL", ...Array.from(labels).sort((a, b) => a.localeCompare(b))];
  }, [deals]);

  const dealCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: deals.length };
    for (const d of deals) {
      const label = dealCategoryLabel(d.category);
      counts[label] = (counts[label] ?? 0) + 1;
    }
    return counts;
  }, [deals]);

  const filteredDeals = useMemo(() => {
    if (dealCategoryFilter === "ALL") return deals;
    return deals.filter((d) => dealCategoryLabel(d.category) === dealCategoryFilter);
  }, [deals, dealCategoryFilter]);

  const dishPagination = usePagination(filtered, PAGE_SIZE.grid, `${tab}|${catFilter}|${search}`);
  const dealPagination = usePagination(filteredDeals, PAGE_SIZE.grid, `${tab}|${dealCategoryFilter}`);
  const categoryPagination = usePagination(categories, PAGE_SIZE.grid, tab);

  function closeDishForm() {
    setDishFormOpen(false);
    setDishForm(emptyDish);
    setEditingDish(null);
    setUploadError("");
  }

  function openAddDish() {
    setDishForm({ ...emptyDish, category: categoryNames[0] || "Main Course" });
    setEditingDish(null);
    setUploadError("");
    setDishFormOpen(true);
  }

  function closeDealForm() {
    setDealFormOpen(false);
    setDealForm(emptyDeal);
    setEditingDeal(null);
    setUploadError("");
  }

  function openAddDeal() {
    setDealForm({
      ...emptyDeal,
      items: [{ menuItemId: items[0]?.id || "", quantity: 1 }],
    });
    setEditingDeal(null);
    setDealFormOpen(true);
  }

  async function onDishSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        ...dishForm,
        price: Number(dishForm.price),
        discountPrice: dishForm.discountPrice ? Number(dishForm.discountPrice) : null,
        optionGroups: dishForm.optionGroups
          .filter((g) => g.name.trim())
          .map((g) => ({
            name: g.name.trim(),
            required: g.required,
            options: g.options
              .filter((o) => o.name.trim())
              .map((o) => ({
                name: o.name.trim(),
                price: Number(o.price) || 0,
                discountPrice: o.discountPrice ? Number(o.discountPrice) : null,
              })),
          })),
        printStationId: dishForm.printStationId || null,
        addons: dishForm.addons
          .filter((a) => a.name.trim())
          .map((a) => ({ name: a.name.trim(), price: Number(a.price) || 0 })),
      };
      if (editingDish) await api(`/menu/${editingDish}`, { method: "PUT", body: JSON.stringify(body) });
      else await api("/menu", { method: "POST", body: JSON.stringify(body) });
      closeDishForm();
      await load(true);
    } finally {
      setSaving(false);
    }
  }

  async function onDealSubmit(e: FormEvent) {
    e.preventDefault();
    const validItems = dealForm.items.filter((i) => i.menuItemId);
    if (validItems.length === 0) {
      setUploadError("Add at least one menu item to the deal.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: dealForm.title,
        description: dealForm.description,
        category: dealForm.category.trim(),
        dealPrice: Number(dealForm.dealPrice),
        imageUrl: dealForm.imageUrl,
        isActive: dealForm.isActive,
        items: validItems,
      };
      if (editingDeal) await api(`/deals/${editingDeal}`, { method: "PUT", body: JSON.stringify(body) });
      else await api("/deals", { method: "POST", body: JSON.stringify(body) });
      closeDealForm();
      await load(true);
    } finally {
      setSaving(false);
    }
  }

  async function onImagePick(e: ChangeEvent<HTMLInputElement>, target: "dish" | "deal") {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError("");
    setUploading(true);
    try {
      const { url } = await apiUpload("/upload/image", file);
      if (target === "dish") setDishForm((f) => ({ ...f, imageUrl: url }));
      else setDealForm((f) => ({ ...f, imageUrl: url }));
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Could not upload image");
    } finally {
      setUploading(false);
    }
  }

  function closeCategoryForm() {
    setCategoryFormOpen(false);
    setCategoryForm(emptyCategory);
    setEditingCategory(null);
    setCategoryError("");
  }

  function openAddCategory() {
    setCategoryForm(emptyCategory);
    setEditingCategory(null);
    setCategoryError("");
    setCategoryFormOpen(true);
  }

  function startEditCategory(cat: Category) {
    const enriched = enrichCategories([cat])[0];
    setEditingCategory(cat.id);
    setCategoryForm({
      name: enriched.name,
      tagline: enriched.tagline || "",
      imageUrl: enriched.imageUrl || "",
    });
    setCategoryError("");
    setCategoryFormOpen(true);
  }

  async function onCategorySubmit(e: FormEvent) {
    e.preventDefault();
    setCategoryError("");
    setSaving(true);
    try {
      const body = { ...categoryForm };
      if (editingCategory) {
        await api(`/categories/${editingCategory}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await api("/categories", { method: "POST", body: JSON.stringify(body) });
      }
      closeCategoryForm();
      await load(true);
    } catch (err) {
      setCategoryError(err instanceof ApiError ? err.message : "Could not save category");
    } finally {
      setSaving(false);
    }
  }

  async function onCategoryImagePick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCategoryError("");
    setUploading(true);
    try {
      const { url } = await apiUpload("/upload/image", file);
      setCategoryForm((f) => ({ ...f, imageUrl: url }));
    } catch (err) {
      setCategoryError(err instanceof ApiError ? err.message : "Could not upload image");
    } finally {
      setUploading(false);
    }
  }

  function removeCategory(id: string) {
    const cat = categories.find((c) => c.id === id);
    setDeleteError("");
    setDeleteTarget({ kind: "category", id, label: cat?.name || "this category" });
  }

  async function toggleDish(item: MenuItem) {
    await api(`/menu/${item.id}`, { method: "PUT", body: JSON.stringify({ isAvailable: !item.isAvailable }) });
    load(true);
  }

  function removeDish(id: string) {
    const dish = items.find((i) => i.id === id);
    setDeleteError("");
    setDeleteTarget({ kind: "dish", id, label: dish?.name || "this dish" });
  }

  async function toggleDeal(deal: Deal) {
    await api(`/deals/${deal.id}`, { method: "PUT", body: JSON.stringify({ isActive: !deal.isActive }) });
    load(true);
  }

  function removeDeal(id: string) {
    const deal = deals.find((d) => d.id === id);
    setDeleteError("");
    setDeleteTarget({ kind: "deal", id, label: deal?.title || "this deal" });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      if (deleteTarget.kind === "category") {
        await api(`/categories/${deleteTarget.id}`, { method: "DELETE" });
      } else if (deleteTarget.kind === "dish") {
        await api(`/menu/${deleteTarget.id}`, { method: "DELETE" });
        if (editingDish === deleteTarget.id) closeDishForm();
      } else {
        await api(`/deals/${deleteTarget.id}`, { method: "DELETE" });
        if (editingDeal === deleteTarget.id) closeDealForm();
      }
      setDeleteTarget(null);
      await load(true);
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Could not delete.");
    } finally {
      setDeleting(false);
    }
  }

  function startEditDish(item: MenuItem) {
    setEditingDish(item.id);
    setDishForm({
      name: item.name,
      description: item.description,
      price: String(item.price),
      discountPrice: item.discountPrice != null ? String(item.discountPrice) : "",
      category: item.category,
      imageUrl: item.imageUrl,
      isAvailable: item.isAvailable,
      optionGroups: (item.optionGroups ?? []).map((g) => ({
        name: g.name,
        required: g.required,
        options: g.options.map((o) => ({
          name: o.name,
          price: String(o.price),
          discountPrice: o.discountPrice != null ? String(o.discountPrice) : "",
        })),
      })),
      addons: (item.addons ?? []).map((a) => ({ name: a.name, price: String(a.price) })),
      printStationId: item.printStationId || item.printStation?.id || "",
    });
    setDishFormOpen(true);
  }

  function startEditDeal(deal: Deal) {
    setEditingDeal(deal.id);
    setDealForm({
      title: deal.title,
      description: deal.description,
      category: deal.category || "",
      dealPrice: String(deal.dealPrice),
      imageUrl: deal.imageUrl,
      isActive: deal.isActive,
      items: deal.items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
    });
    setDealFormOpen(true);
  }

  return (
    <AdminPage>
      <AdminScopeBanner variant="shared" />
      <AdminPageHeader
        title="Menu management"
        description="Dishes, deals, and categories"
        icon={UtensilsCrossed}
        actions={
          <>
            <RefreshButton busy={loading || refreshing} onClick={() => load(true)} />
            <div className="rounded-xl bg-stone-100 px-4 py-2.5 text-center dark:bg-stone-800">
              <p className="text-[11px] text-stone-500 dark:text-stone-400">Dishes</p>
              <p className="text-lg font-bold text-stone-900 dark:text-stone-50">{stats.total}</p>
            </div>
            <div className="rounded-xl bg-violet-50 px-4 py-2.5 text-center ring-1 ring-violet-100 dark:bg-violet-950/40 dark:ring-violet-900/50">
              <p className="text-[11px] text-violet-600 dark:text-violet-300">Deals</p>
              <p className="text-lg font-bold text-violet-800 dark:text-violet-200">{stats.activeDeals}/{stats.deals}</p>
            </div>
          </>
        }
      />

      <AdminSurface>
        <div className="flex flex-wrap items-center gap-2">
          <Segment
            value={tab}
            onChange={setTab}
            options={[
              { id: "dishes", label: "Dishes" },
              { id: "deals", label: "Deals" },
              { id: "categories", label: "Categories" },
            ]}
          />
          <div className="ml-auto flex flex-wrap gap-2">
            {tab === "dishes" && (
              <button type="button" onClick={openAddDish} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500">
                <Plus size={16} /> Add dish
              </button>
            )}
            {tab === "deals" && (
              <button type="button" onClick={openAddDeal} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">
                <Plus size={16} /> Add deal
              </button>
            )}
            {tab === "categories" && (
              <button type="button" onClick={openAddCategory} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500">
                <Plus size={16} /> Add category
              </button>
            )}
          </div>
        </div>
      </AdminSurface>

      {loadError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{loadError}</p>
      )}

      {/* DISHES TAB */}
      {tab === "dishes" && (
        <>
          <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input className="w-full rounded-xl border border-stone-200 bg-stone-50/50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" placeholder="Search dishes…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="flex gap-1.5 overflow-x-auto">
                {["All", ...categoryNames].map((c) => (
                  <button key={c} type="button" onClick={() => setCatFilter(c)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold ${catFilter === c ? "bg-stone-900 text-white" : "bg-stone-50 text-stone-600 ring-1 ring-stone-200"}`}>
                    {c} ({categoryCounts[c] ?? 0})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton aspect-[3/4] rounded-2xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-200 bg-white py-16 text-center">
              <UtensilsCrossed size={36} className="mx-auto text-stone-300" />
              <p className="mt-3 font-medium text-stone-600">
                {search || catFilter !== "All" ? "No dishes match your filters" : "No dishes yet"}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {dishPagination.pageItems.map((item) => {
                const catStyle = CATEGORY_STYLE[item.category] || CATEGORY_STYLE["Main Course"];
                return (
                  <article key={item.id} className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm ${editingDish === item.id ? "border-brand-400 ring-2 ring-brand-100" : "border-stone-200/80"}`}>
                    <div className="relative aspect-[4/3] bg-stone-100">
                      <DishImage src={item.imageUrl} alt={item.name} />
                      {!item.isAvailable && (
                        <div className="absolute inset-0 flex items-center justify-center bg-stone-900/55">
                          <span className="rounded-full bg-red-500 px-3 py-1 text-[11px] font-bold text-white">Out of stock</span>
                        </div>
                      )}
                      <span className={`absolute left-2 top-2 rounded-lg px-2 py-1 text-[10px] font-semibold ring-1 ${catStyle.bg} ${catStyle.text} ${catStyle.ring}`}>{item.category}</span>
                      <p className="absolute bottom-2 right-2 rounded-lg bg-white/95 px-2.5 py-1 text-sm font-bold text-brand-700 shadow-sm">{pkr(item.price)}</p>
                    </div>
                    <div className="p-3.5">
                      <h3 className="font-semibold text-stone-900">{item.name}</h3>
                      {item.description && <p className="mt-1 line-clamp-2 text-xs text-stone-500">{item.description}</p>}
                      <div className="mt-3 grid grid-cols-3 gap-1.5 border-t border-stone-100 pt-3">
                        <button type="button" onClick={() => toggleDish(item)} className="rounded-lg bg-stone-100 py-2 text-[10px] font-semibold text-stone-700 dark:bg-stone-800 dark:text-stone-200 sm:text-xs">{item.isAvailable ? "Out of stock" : "Enable"}</button>
                        <button type="button" onClick={() => startEditDish(item)} className="rounded-lg bg-stone-100 py-2 text-[10px] font-semibold text-stone-700 dark:bg-stone-800 dark:text-stone-200 sm:text-xs"><Pencil size={12} className="mx-auto" /></button>
                        <button type="button" onClick={() => removeDish(item.id)} className="rounded-lg py-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"><Trash2 size={12} className="mx-auto" /></button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {!loading && filtered.length > 0 && (
            <Pagination
              page={dishPagination.page}
              totalPages={dishPagination.totalPages}
              totalItems={dishPagination.totalItems}
              rangeStart={dishPagination.rangeStart}
              rangeEnd={dishPagination.rangeEnd}
              onPageChange={dishPagination.setPage}
              className="mt-4"
            />
          )}
        </>
      )}

      {/* DEALS TAB */}
      {tab === "deals" && (
        <>
          {deals.length > 0 && (
            <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
              <div className="flex gap-1.5 overflow-x-auto">
                {dealFilterOptions.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDealCategoryFilter(c)}
                    className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold ${
                      dealCategoryFilter === c ? "bg-violet-600 text-white" : "bg-stone-50 text-stone-600 ring-1 ring-stone-200"
                    }`}
                  >
                    {c === "ALL" ? "All" : c} ({dealCategoryCounts[c === "ALL" ? "ALL" : c] ?? 0})
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-64 rounded-2xl" />)}
            </div>
          ) : deals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-200 bg-white py-16 text-center">
              <Sparkles size={36} className="mx-auto text-stone-300" />
              <p className="mt-3 font-medium text-stone-600">No deals yet</p>
              <button type="button" onClick={openAddDeal} className="btn-primary mt-4"><Plus size={16} /> Create first deal</button>
            </div>
          ) : filteredDeals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-200 bg-white py-16 text-center">
              <Sparkles size={36} className="mx-auto text-stone-300" />
              <p className="mt-3 font-medium text-stone-600">No deals in this category</p>
              <button type="button" onClick={() => setDealCategoryFilter("ALL")} className="btn-primary mt-4">Show all deals</button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {dealPagination.pageItems.map((deal) => {
                const regular = deal.items.reduce((s, i) => s + Number(i.menuItem.price) * i.quantity, 0);
                const categoryName = dealCategoryLabel(deal.category);
                return (
                  <article key={deal.id} className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
                    <div className="relative aspect-[16/10] bg-violet-50">
                      {deal.imageUrl ? (
                        <img src={deal.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full place-items-center text-violet-300"><Sparkles size={32} /></div>
                      )}
                      {!deal.isActive && (
                        <span className="absolute left-2 top-2 rounded-full bg-stone-800 px-2.5 py-1 text-[10px] font-bold text-white">Hidden</span>
                      )}
                      <span className="absolute left-2 bottom-2 max-w-[calc(100%-5rem)] truncate rounded-lg bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-violet-800 ring-1 ring-violet-100">
                        {categoryName}
                      </span>
                      <span className="absolute bottom-2 right-2 rounded-lg bg-violet-600 px-2.5 py-1 text-sm font-bold text-white">{pkr(deal.dealPrice)}</span>
                    </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-stone-900">{deal.title}</h3>
                    <p className="mt-1 text-xs text-stone-500 line-clamp-2">{deal.description}</p>
                    <ul className="mt-2 space-y-0.5 text-xs text-stone-600">
                      {deal.items.map((i) => (
                        <li key={i.id}>{i.quantity}× {i.menuItem.name}</li>
                      ))}
                    </ul>
                    {regular > Number(deal.dealPrice) && (
                      <p className="mt-2 text-xs font-semibold text-emerald-700">Save {pkr(regular - Number(deal.dealPrice))}</p>
                    )}
                    <div className="mt-3 flex gap-2 border-t border-stone-100 pt-3">
                      <button type="button" onClick={() => toggleDeal(deal)} className="flex-1 rounded-lg bg-stone-100 py-2 text-xs font-semibold">{deal.isActive ? "Hide" : "Activate"}</button>
                      <button type="button" onClick={() => startEditDeal(deal)} className="flex-1 rounded-lg bg-stone-100 py-2 text-xs font-semibold">Edit</button>
                      <button type="button" onClick={() => removeDeal(deal.id)} className="rounded-lg px-3 text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          )}
          {!loading && filteredDeals.length > 0 && (
            <Pagination
              page={dealPagination.page}
              totalPages={dealPagination.totalPages}
              totalItems={dealPagination.totalItems}
              rangeStart={dealPagination.rangeStart}
              rangeEnd={dealPagination.rangeEnd}
              onPageChange={dealPagination.setPage}
              className="mt-4"
            />
          )}
        </>
      )}

      {/* CATEGORIES TAB */}
      {tab === "categories" && (
        loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-48 rounded-2xl" />)}
          </div>
        ) : categories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-white py-16 text-center">
            <FolderPlus size={36} className="mx-auto text-stone-300" />
            <p className="mt-3 font-medium text-stone-600">No categories yet</p>
            <button type="button" onClick={openAddCategory} className="btn-primary mt-4"><Plus size={16} /> Create first category</button>
          </div>
        ) : (
          <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categoryPagination.pageItems.map((cat) => {
              const display = enrichCategories([cat])[0];
              return (
              <article key={cat.id} className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm">
                <div className="relative aspect-[16/7] bg-stone-100">
                  {display.imageUrl ? (
                    <img src={display.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-stone-300"><ImageIcon size={28} /></div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-stone-950/70 to-transparent" />
                  <div className="absolute inset-0 flex flex-col justify-end p-3">
                    {display.tagline && <p className="text-[10px] font-bold uppercase tracking-widest text-brand-300">{display.tagline}</p>}
                    <p className="font-semibold text-white">{display.name}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 p-3">
                  <p className="text-xs text-stone-500">{categoryCounts[cat.name] ?? 0} dishes</p>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => startEditCategory(cat)} className="rounded-lg bg-stone-100 px-2.5 py-1.5 text-xs font-semibold">Edit</button>
                    <button type="button" onClick={() => removeCategory(cat.id)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">Delete</button>
                  </div>
                </div>
              </article>
            );
            })}
          </div>
          <Pagination
            page={categoryPagination.page}
            totalPages={categoryPagination.totalPages}
            totalItems={categoryPagination.totalItems}
            rangeStart={categoryPagination.rangeStart}
            rangeEnd={categoryPagination.rangeEnd}
            onPageChange={categoryPagination.setPage}
            className="mt-4"
          />
          </>
        )
      )}

      {dishFormOpen && (
        <MenuFormSheet
          open={dishFormOpen}
          editingId={editingDish}
          form={dishForm}
          setForm={setDishForm}
          categories={categoryNames}
          printStations={printStations.map((s) => ({ id: s.id, name: s.name, code: s.code }))}
          saving={saving}
          uploading={uploading}
          uploadError={uploadError}
          onClose={closeDishForm}
          onSubmit={onDishSubmit}
          onImagePick={(e) => onImagePick(e, "dish")}
        />
      )}

      {dealFormOpen && (
        <DealFormSheet
          open={dealFormOpen}
          editingId={editingDeal}
          form={dealForm}
          setForm={setDealForm}
          menuItems={items}
          saving={saving}
          uploading={uploading}
          uploadError={uploadError}
          categoryOptions={dealCategoryOptions}
          onClose={closeDealForm}
          onSubmit={onDealSubmit}
          onImagePick={(e) => onImagePick(e, "deal")}
        />
      )}

      {categoryFormOpen && (
        <CategoryFormSheet
          open={categoryFormOpen}
          editingId={editingCategory}
          form={categoryForm}
          setForm={setCategoryForm}
          saving={saving}
          uploading={uploading}
          uploadError={categoryError}
          onClose={closeCategoryForm}
          onSubmit={onCategorySubmit}
          onImagePick={onCategoryImagePick}
        />
      )}

      <ConfirmSheet
        open={Boolean(deleteTarget)}
        title={`Delete ${deleteTarget?.label ?? "item"}?`}
        message="This cannot be undone."
        confirmLabel="Delete"
        danger
        saving={deleting}
        error={deleteError}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={confirmDelete}
      />
    </AdminPage>
  );
}
