"use client";

import Image from "next/image";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Download,
  GripVertical,
  ImageIcon,
  Upload,
  UtensilsCrossed,
} from "lucide-react";
import { ApiError, api } from "@/lib/api";
import { pkr } from "@/lib/format";
import { Category } from "@/lib/types";
import {
  archiveDish,
  deleteDish,
  duplicateDish,
  fetchAdminDishes,
  menuBulk,
  patchDishAvailability,
  patchDishVisibility,
  reorderDishes,
} from "@/lib/admin-menu/api";
import type { AdminDishRow } from "@/lib/admin-menu/types";
import { parseStatusParams, persistViewMode } from "@/lib/admin-menu/filters-url";
import { dishesToCsv, dryRunImport, parseImportCsv } from "@/lib/admin-menu/csv";
import { priceChangeNeedsConfirm } from "@/lib/admin-menu/price-confirm";
import { AdminEmptyState } from "@/components/admin/ui";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { Pagination } from "@/components/Pagination";
import { ConfirmSheet } from "@/components/admin/ConfirmSheet";
import { CatalogViewToggle, parseCatalogView } from "@/modules/catalog/CatalogViewToggle";
import { DishAvailabilitySheet } from "./DishAvailabilitySheet";
import { DishAvailabilityToggle } from "./DishAvailabilityToggle";
import { DishVisibilityToggle } from "./DishVisibilityToggle";
import { DishBulkBar } from "./DishBulkBar";
import { DishBadges } from "./DishBadges";
import { DishRowMenu } from "./DishRowMenu";
import { RefreshButton } from "@/components/admin/RefreshButton";

const PAGE_SIZE = 10;

type Props = {
  header?: ReactNode;
  categories: Category[];
  canManage: boolean;
  canToggleAvailability: boolean;
  canSeeMargin: boolean;
  onAddDish: () => void;
  onEditDish: (id: string) => void;
};

export function DishesTab({
  header,
  categories,
  canManage,
  canToggleAvailability,
  canSeeMargin,
  onAddDish,
  onEditDish,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") || "";
  const view = parseCatalogView(searchParams.get("view"));
  const statusParam = searchParams.get("status") || "";
  const status = parseStatusParams(statusParam);
  const catId = searchParams.get("cat") || "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const [searchInput, setSearchInput] = useState(q);
  const searchParamsKey = searchParams.toString();

  useEffect(() => {
    setSearchInput(q);
  }, [q]);
  const [rows, setRows] = useState<AdminDishRow[]>([]);
  const [counts, setCounts] = useState({
    available: 0,
    soldOut: 0,
    hidden: 0,
    archived: 0,
  });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [availSheet, setAvailSheet] = useState<AdminDishRow | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [undo, setUndo] = useState<{ message: string; action: () => void } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminDishRow | null>(null);
  const [priceEdit, setPriceEdit] = useState<{ row: AdminDishRow; value: string } | null>(null);
  const [importPreview, setImportPreview] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);

  const setQuery = useCallback(
    (patch: Record<string, string | undefined>) => {
      const p = new URLSearchParams(searchParamsKey);
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") p.delete(k);
        else p.set(k, v);
      }
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [pathname, router, searchParamsKey]
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (searchInput !== q) setQuery({ q: searchInput || undefined, page: "1" });
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput, q, setQuery]);

  const load = useCallback(
    async (manual = false) => {
      if (manual) setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        const statusFilters = parseStatusParams(statusParam);
        const res = await fetchAdminDishes({
          q,
          categoryId: catId || undefined,
          status: statusFilters.length ? statusFilters : undefined,
          page,
          pageSize: PAGE_SIZE,
        });
        setRows(res.rows);
        setCounts(res.counts);
        setTotal(res.total);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Could not load dishes.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [q, catId, statusParam, page]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const categoryChips = useMemo(() => {
    const list = [{ id: "", name: "All" }];
    for (const c of categories) list.push({ id: c.id, name: c.name });
    return list;
  }, [categories]);

  const reorderCategoryName = useMemo(() => {
    if (!catId) return null;
    return categories.find((c) => c.id === catId)?.name ?? null;
  }, [catId, categories]);

  async function applyAvailability(row: AdminDishRow, soldOut: boolean, patch?: Parameters<typeof patchDishAvailability>[1]) {
    try {
      if (!soldOut) {
        await patchDishAvailability(row.id, { state: "available" });
      } else if (patch) {
        await patchDishAvailability(row.id, patch);
      } else {
        setAvailSheet(row);
        return;
      }
      const prev = row.availability;
      setUndo({
        message: soldOut ? `${row.name} marked sold out` : `${row.name} available again`,
        action: () => {
          void patchDishAvailability(row.id, {
            state: prev.state === "soldOut" ? "soldOut" : "available",
            until: prev.until === "endOfDay" ? "endOfDay" : prev.until,
          }).then(() => load(true));
        },
      });
      await load(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update availability.");
    }
  }

  async function savePrice() {
    if (!priceEdit) return;
    const newPrice = Number(priceEdit.value);
    const old = priceEdit.row.price;
    if (!Number.isFinite(newPrice) || newPrice <= 0) return;
    if (priceChangeNeedsConfirm(old, newPrice)) {
      const ok = window.confirm(`Change price from ${pkr(old)} to ${pkr(newPrice)}?`);
      if (!ok) return;
    }
    await api(`/menu/${priceEdit.row.id}`, {
      method: "PUT",
      body: JSON.stringify({ price: newPrice }),
    });
    setPriceEdit(null);
    await load(true);
  }

  async function moveReorder(idx: number, dir: -1 | 1) {
    if (!reorderCategoryName) return;
    const next = [...rows];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setRows(next);
    await reorderDishes(reorderCategoryName, next.map((r) => r.id));
    await load(true);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const statusOptions = [
    { value: "", label: "All statuses" },
    { value: "available", label: `Available (${counts.available})` },
    { value: "soldOut", label: `Sold out (${counts.soldOut})` },
    { value: "hidden", label: `Hidden (${counts.hidden})` },
    { value: "archived", label: `Archived (${counts.archived})` },
  ];

  const categoryOptions = categoryChips.map((c) => ({
    value: c.id,
    label: c.id ? c.name : "All categories",
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4" aria-live="polite">
      <div className="flex shrink-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">{header}</div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 xl:justify-end">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search dishes, SKU…"
            className="min-h-11 min-w-[12rem] flex-1 rounded-xl border border-stone-200 bg-white px-3 text-sm dark:border-stone-600 dark:bg-stone-900 xl:max-w-xs"
          />
          <AdminSelect
            value={catId}
            onChange={(v) => setQuery({ cat: v || undefined, page: "1" })}
            options={categoryOptions}
            aria-label="Category"
            minWidth="min-w-[10.5rem]"
            className="shrink-0"
          />
          <AdminSelect
            value={status[0] || ""}
            onChange={(v) => setQuery({ status: v || undefined, page: "1" })}
            options={statusOptions}
            aria-label="Status"
            minWidth="min-w-[10.5rem]"
            className="shrink-0"
          />
          <CatalogViewToggle
            value={view}
            onChange={(v) => {
              persistViewMode(v);
              setQuery({ view: v });
            }}
          />
          {canManage && (
            <>
              <RefreshButton busy={refreshing} onClick={() => load(true)} showLabel={false} />
              <button
                type="button"
                onClick={() => {
                  const csv = dishesToCsv(rows);
                  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "dishes-export.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="grid h-11 w-11 place-items-center rounded-xl border border-stone-200 dark:border-stone-600"
                aria-label="Export CSV"
              >
                <Download size={18} />
              </button>
              <label className="grid h-11 w-11 cursor-pointer place-items-center rounded-xl border border-stone-200 dark:border-stone-600" aria-label="Import CSV">
                <Upload size={18} />
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    void f.text().then((t) => {
                      const { rows: parsed, errors } = parseImportCsv(t);
                      const preview = dryRunImport(parsed);
                      const errLines = [...errors, ...preview.flatMap((p) => p.errors.map((x) => `Line ${p.line}: ${x}`))];
                      setImportPreview(errLines.length ? errLines.join("\n") : "Dry run OK — import apply not wired (preview only).");
                    });
                  }}
                />
              </label>
              <button type="button" onClick={onAddDish} className="min-h-11 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-500">
                Add dish
              </button>
            </>
          )}
        </div>
      </div>
      {canManage && catId ? (
        <button
          type="button"
          onClick={() => setReorderMode((v) => !v)}
          className={`text-xs font-semibold ${reorderMode ? "text-brand-600" : "text-stone-500"}`}
        >
          {reorderMode ? "Done reordering" : "Reorder in this category"}
        </button>
      ) : null}

      <p className="text-xs text-stone-500 dark:text-stone-400">
        Shared catalog — prices and photos are the same everywhere.{" "}
        <span className="font-medium text-stone-700 dark:text-stone-300">Sold-out is per branch</span> (header branch).
      </p>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {importPreview && (
        <pre className="max-h-40 overflow-auto rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs dark:border-stone-700 dark:bg-stone-900">{importPreview}</pre>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton aspect-[3/4] rounded-2xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <AdminEmptyState
          icon={UtensilsCrossed}
          title="No dishes match"
          description="Try clearing filters or add a new dish."
          action={
            canManage ? (
              <button type="button" onClick={onAddDish} className="btn-primary">Add dish</button>
            ) : undefined
          }
        />
      ) : view === "list" ? (
        <div className={`overflow-x-auto rounded-2xl border border-stone-200/80 bg-white dark:border-stone-700 dark:bg-stone-900 ${refreshing ? "opacity-60" : ""}`}>
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-stone-100 text-xs uppercase text-stone-500 dark:border-stone-800">
              <tr>
                {canManage && <th className="px-3 py-3 w-10" />}
                <th className="px-3 py-3">Dish</th>
                <th className="hidden px-3 py-3 md:table-cell">Category</th>
                <th className="px-3 py-3">Price</th>
                <th className="px-3 py-3">Availability</th>
                <th className="hidden px-3 py-3 sm:table-cell">Visibility</th>
                <th className="hidden px-3 py-3 lg:table-cell">Badges</th>
                {canSeeMargin && <th className="hidden px-3 py-3 xl:table-cell">Margin</th>}
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.id} className="border-b border-stone-50 dark:border-stone-800">
                  {canManage && (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={(e) => {
                          const n = new Set(selected);
                          if (e.target.checked) n.add(row.id);
                          else n.delete(row.id);
                          setSelected(n);
                        }}
                        aria-label={`Select ${row.name}`}
                      />
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <div className="flex gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                        {row.thumbnail ? (
                          <Image src={row.thumbnail} alt="" fill className="object-cover" sizes="48px" />
                        ) : (
                          <ImageIcon className="m-3 text-stone-400" size={20} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-stone-900 dark:text-stone-50">{row.name}</p>
                        <p className="line-clamp-1 text-xs text-stone-500">{row.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-3 py-2 text-stone-600 md:table-cell">{row.category}</td>
                  <td className="px-3 py-2 font-semibold">
                    {priceEdit?.row.id === row.id ? (
                      <input
                        value={priceEdit.value}
                        onChange={(e) => setPriceEdit({ row, value: e.target.value })}
                        onBlur={() => void savePrice()}
                        className="w-24 rounded border px-2 py-1"
                        autoFocus
                      />
                    ) : (
                      <button
                        type="button"
                        disabled={!canManage}
                        onClick={() => canManage && setPriceEdit({ row, value: String(row.price) })}
                        className="text-brand-700 dark:text-brand-300"
                      >
                        {pkr(row.price)}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <DishAvailabilityToggle
                      availability={row.availability}
                      disabled={!canToggleAvailability}
                      onToggle={(sold) => void applyAvailability(row, sold)}
                    />
                  </td>
                  <td className="hidden px-3 py-2 sm:table-cell">
                    {canManage && (
                      <DishVisibilityToggle
                        visible={row.visibility === "visible"}
                        onChange={(v) => void patchDishVisibility(row.id, v).then(() => load(true))}
                      />
                    )}
                  </td>
                  <td className="hidden px-3 py-2 lg:table-cell">
                    <DishBadges row={row} showMargin={false} />
                  </td>
                  {canSeeMargin && (
                    <td className="hidden px-3 py-2 text-xs xl:table-cell">
                      {row.marginPercent != null ? `${row.marginPercent}%` : "—"}
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      {reorderMode && reorderCategoryName && (
                        <>
                          <button type="button" aria-label="Move up" onClick={() => void moveReorder(idx, -1)} className="grid h-11 w-11 place-items-center">
                            <ChevronUp size={18} />
                          </button>
                          <button type="button" aria-label="Move down" onClick={() => void moveReorder(idx, 1)} className="grid h-11 w-11 place-items-center">
                            <ChevronDown size={18} />
                          </button>
                          <GripVertical size={16} className="text-stone-400" data-drag-handle aria-hidden />
                        </>
                      )}
                      {canManage && (
                        <DishRowMenu
                          onEdit={() => onEditDish(row.id)}
                          onDuplicate={() => void duplicateDish(row.id).then(() => load(true))}
                          onArchive={() =>
                            void archiveDish(row.id, true).then(() => {
                              setUndo({
                                message: `${row.name} archived`,
                                action: () => void archiveDish(row.id, false).then(() => load(true)),
                              });
                              load(true);
                            })
                          }
                          onDelete={() => setDeleteTarget(row)}
                          canDelete={!row.archivedAt}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${refreshing ? "opacity-60" : ""}`}
        >
          {rows.map((row) => (
            <article
              key={row.id}
              className={`flex flex-col rounded-2xl border bg-white shadow-sm dark:border-stone-700 dark:bg-stone-900 ${
                selected.has(row.id) ? "ring-2 ring-brand-500" : ""
              }`}
            >
              {view === "grid" && (
                <div className="relative aspect-[4/3] bg-stone-100">
                  {canManage && selectMode && (
                    <label className="absolute left-2 top-2 z-10 grid h-11 w-11 place-items-center rounded-xl bg-white/90 shadow">
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-brand-600"
                        checked={selected.has(row.id)}
                        aria-label={`Select ${row.name}`}
                        onChange={() => {
                          const n = new Set(selected);
                          if (n.has(row.id)) n.delete(row.id);
                          else n.add(row.id);
                          setSelected(n);
                        }}
                      />
                    </label>
                  )}
                  {row.thumbnail ? (
                    <Image src={row.thumbnail} alt="" fill className="object-cover" sizes="280px" />
                  ) : (
                    <div className="grid h-full place-items-center text-stone-400">
                      <ImageIcon size={22} />
                    </div>
                  )}
                  {row.availability.state === "soldOut" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-stone-900/55">
                      <span className="rounded-full bg-amber-600 px-3 py-1 text-xs font-bold text-white">Sold out</span>
                    </div>
                  )}
                </div>
              )}
              <div className={view === "grid" ? "p-3.5" : "space-y-2"}>
                <div className="flex items-start justify-between gap-2">
                  {canManage && selectMode && (
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 shrink-0 accent-brand-600"
                      checked={selected.has(row.id)}
                      aria-label={`Select ${row.name}`}
                      onChange={() => {
                        const n = new Set(selected);
                        if (n.has(row.id)) n.delete(row.id);
                        else n.add(row.id);
                        setSelected(n);
                      }}
                    />
                  )}
                  <div className="min-w-0">
                    <h3 className="font-semibold text-stone-900 dark:text-stone-50">{row.name}</h3>
                    {row.description && (
                      <p className="mt-0.5 line-clamp-2 text-[13px] text-stone-600 dark:text-stone-400">{row.description}</p>
                    )}
                  </div>
                  <p className="shrink-0 text-sm font-bold text-brand-700 dark:text-brand-300">{pkr(row.price)}</p>
                </div>
                <DishBadges row={row} showMargin={canSeeMargin} />
                <div className="flex flex-wrap gap-2">
                  <DishAvailabilityToggle
                    availability={row.availability}
                    disabled={!canToggleAvailability}
                    onToggle={(sold) => void applyAvailability(row, sold)}
                  />
                  {canManage && (
                    <DishVisibilityToggle
                      visible={row.visibility === "visible"}
                      onChange={(v) => void patchDishVisibility(row.id, v).then(() => load(true))}
                    />
                  )}
                </div>
                {canManage && (
                  <div className="flex gap-2 border-t border-stone-100 pt-2 dark:border-stone-800">
                    <button type="button" onClick={() => onEditDish(row.id)} className="min-h-11 flex-1 rounded-lg bg-stone-100 text-xs font-semibold dark:bg-stone-800">
                      Edit
                    </button>
                    <DishRowMenu
                      onEdit={() => onEditDish(row.id)}
                      onDuplicate={() => void duplicateDish(row.id).then(() => load(true))}
                      onArchive={() => void archiveDish(row.id, true).then(() => load(true))}
                      onDelete={() => setDeleteTarget(row)}
                      canDelete={!row.archivedAt}
                    />
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      </div>

      {total > 0 ? (
        <div className="mt-auto shrink-0 border-t border-stone-200/80 bg-[#fffaf5] dark:border-stone-700 dark:bg-stone-950">
          <Pagination
            docked
            page={page}
            totalPages={totalPages}
            totalItems={total}
            rangeStart={(page - 1) * PAGE_SIZE + 1}
            rangeEnd={Math.min(page * PAGE_SIZE, total)}
            onPageChange={(p) => setQuery({ page: String(p) })}
          />
        </div>
      ) : null}

      <DishBulkBar
        count={selected.size}
        busy={bulkBusy}
        onClear={() => setSelected(new Set())}
        onSoldOut={() => {
          setBulkBusy(true);
          void menuBulk([...selected], { action: "setAvailability", payload: { state: "soldOut", until: "endOfDay" } })
            .then(() => load(true))
            .finally(() => setBulkBusy(false));
        }}
        onHide={() => {
          setBulkBusy(true);
          void menuBulk([...selected], { action: "setVisibility", visible: false })
            .then(() => load(true))
            .finally(() => setBulkBusy(false));
        }}
        onArchive={() => {
          setBulkBusy(true);
          void menuBulk([...selected], { action: "archive" })
            .then(() => load(true))
            .finally(() => setBulkBusy(false));
        }}
        onAdjustPrice={() => {
          const pct = window.prompt("Adjust price by percent (e.g. 10 or -5):");
          if (pct == null) return;
          setBulkBusy(true);
          void menuBulk([...selected], { action: "adjustPrice", mode: "percent", value: Number(pct) })
            .then(() => load(true))
            .finally(() => setBulkBusy(false));
        }}
      />

      <DishAvailabilitySheet
        open={Boolean(availSheet)}
        dishName={availSheet?.name ?? ""}
        onClose={() => setAvailSheet(null)}
        canAllBranches={canManage}
        onApply={async (patch) => {
          if (availSheet) await applyAvailability(availSheet, true, patch);
        }}
      />

      <ConfirmSheet
        open={Boolean(deleteTarget)}
        title={`Delete ${deleteTarget?.name}?`}
        message="This permanently removes the dish. If it was used in orders, archive instead."
        danger
        confirmLabel="Delete"
        saving={false}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          void deleteDish(deleteTarget.id).then((r) => {
            if ("error" in r && r.suggestArchive) setError("Item is in use — archive instead.");
            setDeleteTarget(null);
            load(true);
          });
        }}
      />

      {undo && (
        <div className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-stone-900 px-4 py-2 text-sm text-white shadow-lg">
          {undo.message}
          <button type="button" className="font-bold text-brand-300" onClick={() => { undo.action(); setUndo(null); }}>
            Undo
          </button>
          <button type="button" aria-label="Dismiss" onClick={() => setUndo(null)}>×</button>
        </div>
      )}
    </div>
  );
}
