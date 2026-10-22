"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, Download, PieChart } from "lucide-react";
import { api, getApiUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { pkr } from "@/lib/format";
import { formatDateSpanLabel } from "@/lib/order-dates";
import {
  REPORT_DATE_PRESETS,
  ReportDatePreset,
  resolveReportDateRange,
} from "@/lib/reports/date-range";
import { Pagination } from "@/components/Pagination";
import { AdminScopeBanner } from "@/components/admin/AdminScopeBanner";
import {
  AdminAlert,
  AdminEmptyState,
  AdminFilterBar,
  AdminKpiCard,
  AdminKpiGrid,
  AdminPage,
  AdminPageHeader,
  AdminPanel,
  InfoTooltip,
  Segment,
} from "@/components/admin/ui";
import { useBranch } from "@/modules/branches/BranchContext";
import { fetchAdminCategories } from "@/lib/admin-menu/api";

const MenuEngineeringQuadrantChart = dynamic(
  () =>
    import("@/components/admin/reports/MenuEngineeringQuadrantChart").then(
      (m) => m.MenuEngineeringQuadrantChart
    ),
  { ssr: false }
);

type Row = {
  menuItemId: string;
  name: string;
  category: string;
  classification: string | null;
  classificationLabel: string;
  quantitySold: number;
  shareOfSalesPercent: number;
  revenue: number;
  marginPerUnit: number;
  totalProfit: number;
  foodCostPercent: number | null;
  costStatus: string;
};

type NoRecipeRow = {
  menuItemId: string;
  name: string;
  category: string;
  costStatus: "no_recipe";
};

type ReportPayload = {
  from: string;
  to: string;
  timezone: string;
  rows: Row[];
  noRecipeRows: NoRecipeRow[];
  thresholds: {
    popularitySharePercent: number;
    weightedAvgMarginPerUnit: number;
    hasEnoughData: boolean;
    classifiedItemCount: number;
    totalUnitsSold: number;
  };
  summary: {
    stars: number;
    plowhorses: number;
    puzzles: number;
    dogs: number;
    profitFromStarsPercent: number;
    totalProfit: number;
  };
  categories: string[];
};

const CLASS_HELP: Record<string, string> = {
  STAR: "Popular and profitable. Promote it, keep quality high.",
  PLOWHORSE: "Popular but low profit. Raise price slightly or cut cost.",
  PUZZLE: "Profitable but not selling. Give it a better spot or rename/promote.",
  DOG: "Unpopular and low profit. Rework or remove.",
};

const CLASS_STYLES: Record<string, string> = {
  STAR: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  PLOWHORSE: "bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  PUZZLE: "bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200",
  DOG: "bg-stone-200 text-stone-800 dark:bg-red-950/40 dark:text-red-200",
};

const PAGE_SIZE = 10;

type SortKey =
  | "name"
  | "category"
  | "class"
  | "quantitySold"
  | "shareOfSalesPercent"
  | "revenue"
  | "marginPerUnit"
  | "totalProfit"
  | "foodCostPercent";

export default function MenuEngineeringPage() {
  const { user } = useAuth();
  const allowed = user?.role === "ADMIN" || user?.role === "MANAGER";
  const { activeBranch } = useBranch();
  const router = useRouter();
  const searchParams = useSearchParams();

  const preset = (searchParams.get("preset") as ReportDatePreset) || "30d";
  const customFrom = searchParams.get("from") ?? "";
  const customTo = searchParams.get("to") ?? "";
  const categoriesParam = searchParams.get("categories") ?? "";
  const selectedCategories = useMemo(
    () => categoriesParam.split(",").map((s) => s.trim()).filter(Boolean),
    [categoriesParam]
  );
  const sort = (searchParams.get("sort") as SortKey) || "totalProfit";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(searchParams.get("page") || 1));

  const [payload, setPayload] = useState<ReportPayload | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [catOpen, setCatOpen] = useState(false);

  const timezone =
    payload?.timezone || activeBranch?.timezone || "Asia/Karachi";

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      const resetsPage = !("page" in patch);
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") next.delete(k);
        else next.set(k, v);
      }
      if (resetsPage) next.set("page", "1");
      router.replace(`?${next.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    if (!searchParams.get("preset")) {
      setParams({ preset: "30d" });
    }
  }, [searchParams, setParams]);

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    try {
      const range =
        preset === "custom"
          ? { from: customFrom, to: customTo }
          : resolveReportDateRange(preset, timezone, customFrom, customTo);
      const q = new URLSearchParams();
      if (range.from) q.set("from", range.from);
      if (range.to) q.set("to", range.to);
      if (selectedCategories.length) q.set("categories", selectedCategories.join(","));
      const data = await api<ReportPayload>(`/admin/reports/menu-engineering?${q}`);
      setPayload(data);
    } catch {
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [allowed, preset, customFrom, customTo, selectedCategories, timezone]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (!allowed) return;
    void fetchAdminCategories({ pageSize: 200 })
      .then((res) => setCategoryOptions(res.rows.map((c) => c.name).sort()))
      .catch(() => setCategoryOptions([]));
  }, [allowed]);

  const sortedRows = useMemo(() => {
    const rows = [...(payload?.rows ?? [])];
    const dir = order === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const pick = (r: Row) => {
        switch (sort) {
          case "name":
            return r.name.toLowerCase();
          case "category":
            return r.category.toLowerCase();
          case "class":
            return r.classificationLabel;
          case "quantitySold":
            return r.quantitySold;
          case "shareOfSalesPercent":
            return r.shareOfSalesPercent;
          case "revenue":
            return r.revenue;
          case "marginPerUnit":
            return r.marginPerUnit;
          case "totalProfit":
            return r.totalProfit;
          case "foodCostPercent":
            return r.foodCostPercent ?? -1;
          default:
            return r.totalProfit;
        }
      };
      const av = pick(a);
      const bv = pick(b);
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * dir;
      return ((av as number) - (bv as number)) * dir;
    });
    return rows;
  }, [payload?.rows, sort, order]);

  const total = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rangeStart = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, total);
  const paginatedRows = sortedRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sort === key) setParams({ order: order === "asc" ? "desc" : "asc" });
    else setParams({ sort: key, order: key === "totalProfit" ? "desc" : "asc" });
  }

  function SortHeader({
    label,
    sortKey,
    align = "left",
  }: {
    label: string;
    sortKey: SortKey;
    align?: "left" | "right";
  }) {
    const active = sort === sortKey;
    return (
      <th className={`px-4 py-3 ${align === "right" ? "text-right" : "text-left"}`}>
        <button
          type="button"
          className={`inline-flex items-center gap-1 ${
            align === "right" ? "justify-end" : ""
          } ${active ? "text-brand-700 dark:text-brand-300" : ""}`}
          onClick={() => toggleSort(sortKey)}
        >
          {label}
          {active ? (order === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : null}
        </button>
      </th>
    );
  }

  function exportCsv() {
    const range =
      preset === "custom"
        ? { from: customFrom, to: customTo }
        : resolveReportDateRange(preset, timezone, customFrom, customTo);
    const q = new URLSearchParams();
    if (range.from) q.set("from", range.from);
    if (range.to) q.set("to", range.to);
    if (selectedCategories.length) q.set("categories", selectedCategories.join(","));
    q.set("format", "csv");
    window.open(`${getApiUrl()}/admin/reports/menu-engineering?${q}`, "_blank");
  }

  function toggleCategory(cat: string) {
    const set = new Set(selectedCategories);
    if (set.has(cat)) set.delete(cat);
    else set.add(cat);
    const next = [...set];
    setParams({ categories: next.length ? next.join(",") : null });
  }

  if (!allowed) {
    return (
      <AdminPage>
        <AdminPageHeader title="Menu engineering" description="Manager access required." />
      </AdminPage>
    );
  }

  const rangeLabel = payload
    ? formatDateSpanLabel(payload.from, payload.to)
    : preset === "custom" && customFrom
      ? formatDateSpanLabel(customFrom, customTo || customFrom)
      : "…";

  const thresholds = payload?.thresholds;
  const summary = payload?.summary;

  return (
    <AdminPage>
      <AdminScopeBanner variant="branch" />

      <AdminPageHeader
        icon={PieChart}
        title="Menu engineering"
        description={`Stars, plowhorses, puzzles, and dogs for ${rangeLabel}. Tax-exclusive prices and recipe costs match Dish costing.`}
        trailing={
          activeBranch ? (
            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">
              {activeBranch.name}
            </span>
          ) : null
        }
        actions={
          <button type="button" className="btn-ghost gap-2" onClick={exportCsv}>
            <Download size={16} /> CSV
          </button>
        }
      />

      <AdminFilterBar className="!flex !flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Segment
            value={preset}
            onChange={(v) => setParams({ preset: v, from: null, to: null })}
            options={REPORT_DATE_PRESETS}
          />
          {preset === "custom" && (
            <>
              <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400">
                <span className="font-medium">From</span>
                <input
                  type="date"
                  className="input admin-select !py-2"
                  value={customFrom}
                  onChange={(e) => setParams({ from: e.target.value })}
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400">
                <span className="font-medium">To</span>
                <input
                  type="date"
                  className="input admin-select !py-2"
                  value={customTo}
                  onChange={(e) => setParams({ to: e.target.value })}
                />
              </label>
            </>
          )}
          <div className="relative">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-200"
              onClick={() => setCatOpen((o) => !o)}
            >
              Category
              {selectedCategories.length > 0 && (
                <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {selectedCategories.length}
                </span>
              )}
            </button>
            {catOpen && (
              <div className="absolute z-20 mt-1 max-h-56 w-56 overflow-y-auto rounded-xl border border-stone-200 bg-white p-2 shadow-lg dark:border-stone-600 dark:bg-stone-900">
                {categoryOptions.length === 0 ? (
                  <p className="px-2 py-1 text-xs text-stone-500">No categories</p>
                ) : (
                  categoryOptions.map((cat) => (
                    <label
                      key={cat}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-stone-50 dark:hover:bg-stone-800"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(cat)}
                        onChange={() => toggleCategory(cat)}
                      />
                      {cat}
                    </label>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </AdminFilterBar>

      <details className="rounded-2xl border border-stone-200/80 bg-white px-4 py-3 text-sm shadow-sm dark:border-stone-700 dark:bg-stone-900">
        <summary className="cursor-pointer font-semibold text-stone-800 dark:text-stone-100">
          How to read this report
        </summary>
        <div className="mt-3 space-y-4 text-stone-600 dark:text-stone-400">
          <p>
            Each dish is plotted by <strong>how often it sells</strong> (share of all units in the date range) and{" "}
            <strong>how much profit one serving makes</strong> (tax-exclusive menu price minus recipe cost — same as
            Dish costing). Only <strong>completed</strong> orders count (delivered, collected, or served dine-in).
          </p>
          {thresholds && (
            <p className="rounded-xl bg-stone-50 px-3 py-2 text-xs dark:bg-stone-800/60">
              <strong className="text-stone-800 dark:text-stone-200">This period&apos;s cut-offs:</strong>{" "}
              &quot;Popular&quot; = {thresholds.popularitySharePercent}% or more of unit sales · &quot;High
              margin&quot; = {pkr(thresholds.weightedAvgMarginPerUnit)} or more per unit. The dashed lines on the chart
              are exactly these values.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(CLASS_HELP).map(([k, text]) => (
              <div
                key={k}
                className="flex gap-2 rounded-xl border border-stone-100 bg-stone-50/80 p-3 dark:border-stone-700 dark:bg-stone-800/40"
              >
                <span className={`shrink-0 rounded-lg px-2 py-0.5 text-xs font-bold ${CLASS_STYLES[k]}`}>
                  {k}
                </span>
                <span className="text-xs leading-relaxed">{text}</span>
              </div>
            ))}
          </div>
          <ul className="list-disc space-y-1.5 pl-5 text-xs">
            <li>
              <strong>Chart</strong> — right &amp; up = Star territory; right &amp; down = Plowhorse; left &amp; up =
              Puzzle; left &amp; down = Dog. Hover a dot for the dish name.
            </li>
            <li>
              <strong>Table</strong> — default sort is total profit (Rs). Share % is units for that dish ÷ all units
              sold, not revenue share.
            </li>
            <li>
              <strong>Qty 0</strong> — still listed so true slow sellers show as Dogs, not hidden.
            </li>
          </ul>
        </div>
      </details>

      {payload && !thresholds?.hasEnoughData && (
        <div className="mb-4">
        <AdminAlert variant="warning">
          Not enough data yet for reliable classes — need at least 8 dishes with recipes and 30 units
          sold in range (currently {thresholds?.classifiedItemCount ?? 0} dishes,{" "}
          {thresholds?.totalUnitsSold ?? 0} units). The table still lists all items.
        </AdminAlert>
        </div>
      )}

      {summary && thresholds?.hasEnoughData && (
        <AdminKpiGrid className="mb-4">
          <AdminKpiCard label="Stars" value={String(summary.stars)} />
          <AdminKpiCard label="Plowhorses" value={String(summary.plowhorses)} />
          <AdminKpiCard label="Puzzles" value={String(summary.puzzles)} />
          <AdminKpiCard label="Dogs" value={String(summary.dogs)} />
          <AdminKpiCard
            label="Profit from Stars"
            value={`${summary.profitFromStarsPercent}%`}
            hint="Share of total contribution profit"
          />
        </AdminKpiGrid>
      )}

      {payload && sortedRows.length > 0 && (
        <AdminPanel
          className="mb-4"
          title="Popularity vs margin"
          description="Horizontal = share of units sold · Vertical = profit per serving (Rs)"
        >
          <MenuEngineeringQuadrantChart
            points={sortedRows.map((r) => ({
              id: r.menuItemId,
              name: r.name,
              sharePercent: r.shareOfSalesPercent,
              marginPerUnit: r.marginPerUnit,
              classification: r.classification,
            }))}
            popularitySharePercent={thresholds?.popularitySharePercent ?? 0}
            marginThreshold={thresholds?.weightedAvgMarginPerUnit ?? 0}
            hasEnoughData={thresholds?.hasEnoughData ?? false}
          />
        </AdminPanel>
      )}

      {loading && !payload ? (
        <div className="skeleton h-72 rounded-2xl" />
      ) : !loading && (!payload || sortedRows.length === 0) ? (
        <AdminEmptyState
          icon={PieChart}
          title="No dishes in scope"
          description="Adjust categories or branch selection."
        />
      ) : (
        <AdminPanel
          title="All dishes"
          description={`${total} with recipes · ${PAGE_SIZE} per page · click column headers to sort`}
        >
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full text-sm">
              <thead className="border-b border-stone-100 bg-stone-50 text-xs font-semibold text-stone-600 dark:border-stone-800 dark:bg-stone-800/80 dark:text-stone-300">
                <tr>
                  <SortHeader label="Item" sortKey="name" />
                  <SortHeader label="Category" sortKey="category" />
                  <SortHeader label="Class" sortKey="class" />
                  <SortHeader label="Qty" sortKey="quantitySold" align="right" />
                  <SortHeader label="Share %" sortKey="shareOfSalesPercent" align="right" />
                  <SortHeader label="Revenue" sortKey="revenue" align="right" />
                  <SortHeader label="Margin / unit" sortKey="marginPerUnit" align="right" />
                  <SortHeader label="Total profit" sortKey="totalProfit" align="right" />
                  <th className="px-4 py-3 text-right">
                    <span className="inline-flex items-center justify-end gap-1">
                      Food cost %
                      <InfoTooltip
                        label="Food cost help"
                        title="Food cost %"
                        bullets={[
                          "Recipe cost as % of tax-exclusive price — same as Dish costing.",
                          "Shown only when the recipe is complete.",
                        ]}
                      />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-stone-900">
                {paginatedRows.map((r) => (
                  <tr
                    key={r.menuItemId}
                    className="border-t border-stone-100 hover:bg-stone-50/80 dark:border-stone-800 dark:hover:bg-stone-800/40"
                  >
                    <td className="px-4 py-3 font-semibold text-stone-900 dark:text-stone-50">{r.name}</td>
                    <td className="px-4 py-3 text-stone-600 dark:text-stone-300">{r.category}</td>
                    <td className="px-4 py-3">
                      {r.classification ? (
                        <span
                          className={`rounded-lg px-2 py-1 text-xs font-bold ${CLASS_STYLES[r.classification]}`}
                          title={CLASS_HELP[r.classification]}
                        >
                          {r.classification}
                        </span>
                      ) : (
                        <span className="text-xs text-stone-500">{r.classificationLabel}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.quantitySold}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.shareOfSalesPercent}%</td>
                    <td className="px-4 py-3 text-right tabular-nums">{pkr(r.revenue)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{pkr(r.marginPerUnit)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-stone-900 dark:text-stone-50">
                      {pkr(r.totalProfit)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.costStatus !== "ok" ? "—" : r.foodCostPercent != null ? `${r.foodCostPercent}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > PAGE_SIZE && (
            <div className="-mx-4 mt-4 border-t border-stone-100 px-4 pt-3 dark:border-stone-800">
              <Pagination
                docked
                page={safePage}
                totalPages={totalPages}
                totalItems={total}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                onPageChange={(p) => setParams({ page: String(p) })}
              />
            </div>
          )}
        </AdminPanel>
      )}

      {payload && payload.noRecipeRows.length > 0 && (
        <AdminPanel
          title="No recipe"
          description="Excluded from the matrix until a recipe is added in Inventory"
        >
          <ul className="divide-y divide-stone-100 text-sm dark:divide-stone-800">
            {payload.noRecipeRows.map((r) => (
              <li key={r.menuItemId} className="flex justify-between gap-2 py-2 first:pt-0 last:pb-0">
                <span className="font-medium text-stone-900 dark:text-stone-50">{r.name}</span>
                <span className="text-stone-500">{r.category}</span>
              </li>
            ))}
          </ul>
        </AdminPanel>
      )}
    </AdminPage>
  );
}
