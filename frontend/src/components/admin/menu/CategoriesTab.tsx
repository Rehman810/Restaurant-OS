"use client";

import Image from "next/image";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, FolderPlus, GripVertical, ImageIcon, Pencil } from "lucide-react";
import { ApiError } from "@/lib/api";
import { enrichCategories } from "@/lib/category-meta";
import {
  deleteAdminCategory,
  fetchAdminCategories,
  patchCategoryVisibility,
  reorderCategories,
} from "@/lib/admin-menu/api";
import type { AdminCategoryRow } from "@/lib/admin-menu/types";
import { parseCategoryStatusParams } from "@/lib/admin-menu/filters-url";
import { categoryScheduleStatusLabel } from "@/lib/admin-menu/category-schedule-label";
import { AdminEmptyState } from "@/components/admin/ui";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { CatalogViewToggle, parseCatalogView } from "@/modules/catalog/CatalogViewToggle";
import { Pagination } from "@/components/Pagination";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { DishVisibilityToggle } from "./DishVisibilityToggle";
import { CategoryDeleteSheet } from "./CategoryDeleteSheet";

const PAGE_SIZE = 10;

type Props = {
  header?: ReactNode;
  canManage: boolean;
  onAddCategory: () => void;
  onEditCategory: (row: AdminCategoryRow) => void;
  onCategoriesChanged?: () => void;
};

export function CategoriesTab({ header, canManage, onAddCategory, onEditCategory, onCategoriesChanged }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const cq = searchParams.get("cq") || "";
  const status = parseCategoryStatusParams(searchParams.get("cstatus"));
  const page = Math.max(1, Number(searchParams.get("cpage")) || 1);
  const view = parseCatalogView(searchParams.get("cview"));

  const [searchInput, setSearchInput] = useState(cq);
  const [rows, setRows] = useState<AdminCategoryRow[]>([]);
  const [counts, setCounts] = useState({ active: 0, scheduled: 0, hidden: 0 });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [reorderMode, setReorderMode] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminCategoryRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const setQuery = useCallback(
    (patch: Record<string, string | undefined>) => {
      const p = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") p.delete(k);
        else p.set(k, v);
      }
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (searchInput !== cq) setQuery({ cq: searchInput || undefined, cpage: "1" });
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput, cq, setQuery]);

  const load = useCallback(
    async (manual = false) => {
      if (manual) setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        const res = await fetchAdminCategories({
          q: cq,
          status: status.length ? status : undefined,
          page,
          pageSize: PAGE_SIZE,
        });
        setRows(res.rows);
        setCounts(res.counts);
        setTotal(res.total);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Could not load categories.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [cq, status.join(","), page]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;

  async function moveCategory(index: number, dir: -1 | 1) {
    const next = [...rows];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    setRows(next);
    try {
      await reorderCategories(next.map((r) => r.id));
      onCategoriesChanged?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not reorder.");
      await load(true);
    }
  }

  async function confirmDelete(moveToCategoryId?: string) {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await deleteAdminCategory(deleteTarget.id, moveToCategoryId);
      if ("error" in res && res.error) {
        setDeleteError(res.error);
        return;
      }
      setDeleteTarget(null);
      await load(true);
      onCategoriesChanged?.();
    } catch (e) {
      setDeleteError(e instanceof ApiError ? e.message : "Could not delete.");
    } finally {
      setDeleting(false);
    }
  }

  function displayCat(row: AdminCategoryRow) {
    return enrichCategories([
      { id: row.id, name: row.name, tagline: row.tagline, imageUrl: row.imageUrl, sortOrder: row.sortOrder, createdAt: "" },
    ])[0];
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4" aria-live="polite">
      <div className="flex shrink-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">{header}</div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 xl:justify-end">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search categories…"
            className="min-h-11 min-w-[12rem] flex-1 rounded-xl border border-stone-200 bg-white px-3 text-sm dark:border-stone-600 dark:bg-stone-900 xl:max-w-xs"
          />
          <AdminSelect
            value={status[0] || ""}
            onChange={(v) => setQuery({ cstatus: v || undefined, cpage: "1" })}
            options={[
              { value: "", label: "All statuses" },
              { value: "active", label: `On menu (${counts.active})` },
              { value: "scheduled", label: `Off hours (${counts.scheduled})` },
              { value: "hidden", label: `Hidden (${counts.hidden})` },
            ]}
            aria-label="Category status"
            minWidth="min-w-[11rem]"
            className="shrink-0"
          />
          <CatalogViewToggle value={view} onChange={(v) => setQuery({ cview: v })} />
          <RefreshButton busy={refreshing} onClick={() => load(true)} showLabel={false} />
          {canManage && (
            <>
              <button
                type="button"
                onClick={() => setReorderMode((v) => !v)}
                className={`min-h-11 rounded-xl px-3 text-sm font-semibold ring-1 ${
                  reorderMode ? "bg-brand-600 text-white ring-brand-600" : "bg-white ring-stone-200 dark:bg-stone-900"
                }`}
              >
                {reorderMode ? "Done" : "Reorder"}
              </button>
              <button type="button" onClick={onAddCategory} className="min-h-11 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white">
                Add category
              </button>
            </>
          )}
        </div>
      </div>

      {error && <p className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      <div className="min-h-0 flex-1 overflow-y-auto">
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-64 rounded-2xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <AdminEmptyState icon={FolderPlus} title="No categories" description="Create a category or adjust filters." />
      ) : view === "list" ? (
        <div className={`overflow-x-auto rounded-2xl border border-stone-200/80 bg-white dark:border-stone-700 dark:bg-stone-900 ${refreshing ? "opacity-60" : ""}`}>
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-stone-100 text-xs uppercase text-stone-500 dark:border-stone-800">
              <tr>
                {reorderMode && canManage && <th className="px-3 py-3 w-12" />}
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3">Dishes</th>
                <th className="hidden px-3 py-3 lg:table-cell">Schedule</th>
                <th className="px-3 py-3">Visibility</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const display = displayCat(row);
                return (
                  <tr key={row.id} className="border-b border-stone-50 dark:border-stone-800">
                    {reorderMode && canManage && (
                      <td className="px-3 py-2">
                        <div className="flex flex-col">
                          <button type="button" aria-label="Move up" disabled={start + index === 0} onClick={() => void moveCategory(index, -1)} className="disabled:opacity-30">
                            <ChevronUp size={16} />
                          </button>
                          <button type="button" aria-label="Move down" disabled={start + index === rows.length - 1} onClick={() => void moveCategory(index, 1)} className="disabled:opacity-30">
                            <ChevronDown size={16} />
                          </button>
                        </div>
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <p className="font-semibold text-stone-900 dark:text-stone-50">{display.name}</p>
                      {display.tagline ? <p className="text-xs text-stone-500">{display.tagline}</p> : null}
                    </td>
                    <td className="px-3 py-2 text-stone-600">{row.dishCount}</td>
                    <td className="hidden px-3 py-2 text-xs text-stone-500 lg:table-cell">
                      {categoryScheduleStatusLabel(row.scheduleStatus)} · {row.scheduleSummary}
                    </td>
                    <td className="px-3 py-2">
                      {canManage && (
                        <DishVisibilityToggle
                          visible={row.isVisible && !row.archivedAt}
                          onChange={(v) => void patchCategoryVisibility(row.id, v).then(() => load(true))}
                        />
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {canManage && (
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => onEditCategory(row)} className="min-h-11 rounded-xl bg-stone-100 px-3 text-xs font-semibold dark:bg-stone-800">
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteError("");
                              setDeleteTarget(row);
                            }}
                            className="min-h-11 rounded-xl px-3 text-xs font-semibold text-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className={`grid grid-cols-1 content-start gap-4 sm:grid-cols-2 xl:grid-cols-3 ${refreshing ? "opacity-60" : ""}`}>
          {rows.map((row, index) => {
            const display = displayCat(row);
            return (
              <li
                key={row.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-900"
              >
                <div className="relative aspect-[16/10] bg-stone-100">
                  {display.imageUrl ? (
                    <Image src={display.imageUrl} alt="" fill className="object-cover" sizes="(max-width: 640px) 100vw, 33vw" />
                  ) : (
                    <div className="grid h-full place-items-center text-stone-400">
                      <ImageIcon size={28} />
                    </div>
                  )}
                  <span className="absolute right-2.5 top-2.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-stone-700 shadow-sm dark:bg-stone-900/90 dark:text-stone-200">
                    {row.dishCount} {row.dishCount === 1 ? "dish" : "dishes"}
                  </span>
                  {reorderMode && canManage && (
                    <div className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-xl bg-white/95 p-1 shadow-sm dark:bg-stone-900/90">
                      <GripVertical className="text-stone-400" size={14} aria-hidden />
                      <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => void moveCategory(index, -1)} className="grid h-9 w-9 place-items-center disabled:opacity-30">
                        <ChevronUp size={16} />
                      </button>
                      <button type="button" aria-label="Move down" disabled={index === rows.length - 1} onClick={() => void moveCategory(index, 1)} className="grid h-9 w-9 place-items-center disabled:opacity-30">
                        <ChevronDown size={16} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-2 p-3.5">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-stone-900 dark:text-stone-50">{display.name}</h3>
                    {display.tagline ? (
                      <p className="mt-0.5 line-clamp-1 text-sm text-stone-500">{display.tagline}</p>
                    ) : null}
                  </div>
                  <p className="text-xs text-stone-500">
                    {row.scheduleStatus !== "active" ? (
                      <>
                        <span className="font-medium text-stone-700 dark:text-stone-300">
                          {categoryScheduleStatusLabel(row.scheduleStatus)}
                        </span>
                        {" · "}
                      </>
                    ) : null}
                    {row.scheduleSummary}
                  </p>
                  {canManage && (
                    <div className="mt-auto flex items-center gap-2 border-t border-stone-100 pt-3 dark:border-stone-800">
                      <DishVisibilityToggle
                        visible={row.isVisible && !row.archivedAt}
                        onChange={(v) => void patchCategoryVisibility(row.id, v).then(() => load(true))}
                      />
                      <button
                        type="button"
                        onClick={() => onEditCategory(row)}
                        className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-stone-100 px-3 text-xs font-semibold dark:bg-stone-800"
                      >
                        <Pencil size={14} /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError("");
                          setDeleteTarget(row);
                        }}
                        className="min-h-11 rounded-xl px-3 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      </div>

      {total > 0 ? (
        <div className="mt-auto shrink-0 border-t border-stone-200/80 bg-[#fffaf5] dark:border-stone-700 dark:bg-stone-950">
          <Pagination
            docked
            page={safePage}
            totalPages={totalPages}
            totalItems={total}
            rangeStart={start + 1}
            rangeEnd={Math.min(start + PAGE_SIZE, total)}
            onPageChange={(p) => setQuery({ cpage: String(p) })}
          />
        </div>
      ) : null}

      <CategoryDeleteSheet
        open={Boolean(deleteTarget)}
        target={deleteTarget}
        otherCategories={rows}
        saving={deleting}
        error={deleteError}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={(moveTo) => void confirmDelete(moveTo)}
      />
    </div>
  );
}
