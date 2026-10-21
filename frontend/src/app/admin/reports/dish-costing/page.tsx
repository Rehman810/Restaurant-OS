"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Download, SlidersHorizontal, TrendingUp, UtensilsCrossed } from "lucide-react";
import { Pagination } from "@/components/Pagination";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { api, getApiUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { pkr } from "@/lib/format";
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
  SearchField,
  SelectField,
} from "@/components/admin/ui";
import { useBranch } from "@/modules/branches/BranchContext";
import {
  bandLabel,
  canShowMargin,
  COST_BASIS_COPY,
  formatCostMoney,
  formatPercent1,
  needsRecipeCheck,
  statusLabel,
} from "@/lib/costing/helpers";
import type { DishCostStatus } from "@/lib/costing/helpers";
import type { DishCostingResponse, DishCostingRow } from "@/components/admin/dish-costing/types";

const DishCostingDetailSheet = dynamic(
  () =>
    import("@/components/admin/dish-costing/DishCostingDetailSheet").then((m) => m.DishCostingDetailSheet),
  { ssr: false }
);

const DishCostingWhatIf = dynamic(
  () => import("@/components/admin/dish-costing/DishCostingWhatIf").then((m) => m.DishCostingWhatIf),
  { ssr: false }
);

function BandBadge({ band, status }: { band: DishCostingRow["foodCostBand"]; status: DishCostStatus }) {
  if (needsRecipeCheck(status)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
        {statusLabel(status) ?? "Check recipe"}
      </span>
    );
  }
  const styles = {
    HEALTHY: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
    WATCH: "bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
    HIGH: "bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-200",
    UNKNOWN: "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold ${styles[band]}`}>
      {bandLabel(band)}
    </span>
  );
}

const STATUS_OPTIONS = [
  { value: "", label: "All dishes" },
  { value: "above_target", label: "Above target" },
  { value: "needs_check", label: "Needs recipe check" },
  { value: "healthy", label: "On target" },
];

const SALES_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const PAGE_SIZE = 10;

export default function DishCostingPage() {
  const { user } = useAuth();
  const allowed = user?.role === "ADMIN" || user?.role === "MANAGER";
  const { activeBranch } = useBranch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<DishCostingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<DishCostingRow | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [whatIfOpen, setWhatIfOpen] = useState(false);

  const q = searchParams.get("q") ?? "";
  const [searchInput, setSearchInput] = useState(q);
  const status = searchParams.get("status") ?? "";
  const salesDays = searchParams.get("salesDays") ?? "30";
  const sort = searchParams.get("sort") ?? "name";
  const order = searchParams.get("order") ?? "asc";
  const includeCombos = searchParams.get("includeCombos") !== "false";
  const page = Number(searchParams.get("page") || 1);

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams.toString());
      if (!value) next.delete(key);
      else next.set(key, value);
      if (key !== "page") next.set("page", "1");
      router.replace(`?${next.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => setSearchInput(q), [q]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (searchInput !== q) setParam("q", searchInput);
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput, q, setParam]);

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status) params.set("status", status);
      params.set("salesDays", salesDays);
      params.set("include", "sales");
      params.set("sort", sort);
      params.set("order", order);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      params.set("includeCombos", includeCombos ? "true" : "false");
      const res = await api<DishCostingResponse>(`/admin/reports/dish-costing?${params}`);
      setData(res);
    } catch {
      setError("Could not load dish costing.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [allowed, q, status, salesDays, sort, order, page, includeCombos]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openRow(row: DishCostingRow) {
    setSelected(row);
    setDetail(null);
    try {
      const d = await api<Record<string, unknown>>(`/admin/reports/dish-costing/${row.id}?type=${row.type}`);
      setDetail(d);
    } catch {
      setDetail(null);
    }
  }

  function exportCsv() {
    window.open(`${getApiUrl()}/admin/reports/dish-costing.csv?${searchParams.toString()}`, "_blank");
  }

  const currencySymbol = "Rs";
  const target = data?.meta.targetFoodCostPercent ?? 32;
  const costAsOf = data?.summary.costAsOf ? new Date(data.summary.costAsOf).toLocaleString() : "";

  const rows = data?.items ?? [];
  const total = data?.pagination.total ?? 0;
  const pageSize = data?.pagination.pageSize ?? PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  function toggleSort(key: string) {
    if (sort === key) setParam("order", order === "asc" ? "desc" : "asc");
    else setParam("sort", key);
  }

  if (!allowed) {
    return (
      <AdminPage>
        <AdminPageHeader title="Dish costing" description="Admin or manager access required." icon={UtensilsCrossed} />
      </AdminPage>
    );
  }

  const headerDescription = [
    COST_BASIS_COPY,
    data?.meta.priceBasisLabel,
    costAsOf ? `Costs as of ${costAsOf}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <AdminPage className="pb-24 lg:pb-5">
      <AdminPageHeader
        icon={UtensilsCrossed}
        title="Dish costing"
        description={headerDescription}
        trailing={
          activeBranch ? (
            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">
              {activeBranch.name}
            </span>
          ) : null
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <RefreshButton busy={loading} onClick={() => void load()} />
            <button type="button" className="btn-ghost gap-2" onClick={() => setWhatIfOpen(true)}>
              <SlidersHorizontal size={16} /> What if?
            </button>
            <button type="button" className="btn-ghost gap-2" onClick={exportCsv}>
              <Download size={16} /> CSV
            </button>
          </div>
        }
      />

      {error && <AdminAlert variant="error">{error}</AdminAlert>}

      {data && (
        <AdminKpiGrid>
          <AdminKpiCard
            label="Average food cost"
            value={formatPercent1(
              data.summary.averageFoodCostPercentWeighted ?? data.summary.averageFoodCostPercentUnweighted
            )}
            hint={`Target ${target}%`}
            icon={TrendingUp}
            accent="brand"
            onClick={() => setParam("status", "")}
          />
          <AdminKpiCard
            label="Above target"
            value={(data.summary.bandCounts.WATCH ?? 0) + (data.summary.bandCounts.HIGH ?? 0)}
            icon={AlertCircle}
            accent="amber"
            onClick={() => setParam("status", "above_target")}
          />
          <AdminKpiCard
            label="Needs recipe check"
            value={
              (data.summary.statusCounts.INCOMPLETE ?? 0) +
              (data.summary.statusCounts.NO_RECIPE ?? 0) +
              (data.summary.statusCounts.SUSPICIOUS_LOW ?? 0)
            }
            icon={UtensilsCrossed}
            accent="violet"
            onClick={() => setParam("status", "needs_check")}
          />
          <AdminKpiCard
            label="Est. monthly shortfall"
            value={pkr(data.summary.estimatedMonthlyShortfall)}
            hint="Estimate from watch/high items with a price gap"
            icon={TrendingUp}
            accent="sky"
          />
        </AdminKpiGrid>
      )}

      <AdminFilterBar className="grid-cols-1 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,11rem)_minmax(0,11rem)_auto] xl:items-end">
        <SearchField value={searchInput} onChange={setSearchInput} placeholder="Search dishes…" />
        <SelectField label="Show" value={status} onChange={(v) => setParam("status", v)} options={STATUS_OPTIONS} />
        <SelectField label="Sales period" value={salesDays} onChange={(v) => setParam("salesDays", v)} options={SALES_OPTIONS} />
        <label className="flex min-h-[42px] items-center gap-2 pb-1 text-sm text-stone-700 dark:text-stone-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-stone-300 text-brand-600"
            checked={includeCombos}
            onChange={(e) => setParam("includeCombos", e.target.checked ? "true" : "false")}
          />
          Include combos
        </label>
      </AdminFilterBar>

      <details className="rounded-2xl border border-stone-200/80 bg-stone-50/50 px-4 py-3 text-sm dark:border-stone-700 dark:bg-stone-800/30">
        <summary className="cursor-pointer font-semibold text-stone-800 dark:text-stone-200">
          How to read this report
        </summary>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-stone-600 dark:text-stone-400">
          <li>
            <strong>Cost</strong> — recipe cost per serving (branch average purchase price, else default ingredient cost).
          </li>
          <li>
            <strong>Margin</strong> — menu price minus cost (before tax when your store prices include tax). Shown only when the recipe is complete.
          </li>
          <li>
            <strong>Target status</strong> — compares food cost % to your settings:{" "}
            <em>On target</em> (at or below {target}%), <em>Above target</em>, or <em>High food cost</em>.{" "}
            <em>Check recipe</em> means missing recipe, missing costs, or unusually low cost — fix before trusting margin.
          </li>
          <li>
            <strong>Sold / Profit</strong> — units and gross profit in the sales period you picked above.
          </li>
          <li>
            <strong>Suggested</strong> — menu price to hit your target food cost % (rounded up); only shown for above-target dishes.
          </li>
          <li>
            <strong>What if?</strong> — pick an ingredient and a price change to see which dishes would move to a different target status (preview only).
          </li>
        </ul>
      </details>

      {loading && !data ? (
        <div className="skeleton h-72 rounded-2xl" />
      ) : !loading && rows.length === 0 ? (
        <AdminEmptyState
          icon={UtensilsCrossed}
          title="No dishes match"
          description="Add recipes in Inventory or adjust your filters."
        />
      ) : (
        <>
          <AdminPanel
            title="Dishes"
            description={`${total} total · ${PAGE_SIZE} per page · click column headers to sort · click a row for details`}
          >
          <div className="hidden lg:block overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm">
              <thead className="border-b border-stone-100 bg-stone-50 text-xs font-semibold text-stone-600 dark:border-stone-800 dark:bg-stone-800/80 dark:text-stone-300">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <button type="button" onClick={() => toggleSort("name")}>Dish</button>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <button type="button" onClick={() => toggleSort("price")}>Price</button>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <button type="button" onClick={() => toggleSort("cost")}>Cost</button>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <button type="button" onClick={() => toggleSort("margin")}>Margin</button>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <span className="inline-flex items-center justify-end gap-1">
                      Target status
                      <InfoTooltip
                        label="Target status help"
                        title="Target status (food cost band)"
                        bullets={[
                          `On target — food cost is at or below your ${target}% target.`,
                          "Above target — food cost is higher than target but not extreme.",
                          "High food cost — cost is above your high threshold; consider price or recipe changes.",
                          "Check recipe — incomplete data; do not use margin for decisions.",
                        ]}
                      />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <button type="button" onClick={() => toggleSort("sold")}>Sold</button>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <button type="button" onClick={() => toggleSort("profit")}>Profit</button>
                  </th>
                  <th className="px-4 py-3 text-right">Suggested price</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => {
                  const showMargin = canShowMargin(d.status);
                  return (
                    <tr
                      key={`${d.type}-${d.id}`}
                      className="border-t border-stone-100 hover:bg-stone-50/80 dark:border-stone-800 dark:hover:bg-stone-800/40 cursor-pointer"
                      tabIndex={0}
                      onClick={() => void openRow(d)}
                      onKeyDown={(e) => e.key === "Enter" && void openRow(d)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-stone-900 dark:text-stone-50">{d.name}</p>
                        <p className="text-xs text-stone-500">
                          {d.category}
                          {d.type === "COMBO" ? " · Combo" : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{pkr(d.price)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {d.recipeCostDisplay != null ? formatCostMoney(currencySymbol, d.recipeCostDisplay) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-stone-800 dark:text-stone-200">
                        {showMargin ? (
                          <>
                            {formatCostMoney(currencySymbol, d.marginAmount)}
                            <span className="block text-xs text-stone-500">{formatPercent1(d.marginPercent)}</span>
                          </>
                        ) : (
                          <span className="text-xs text-amber-800 dark:text-amber-200">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <BandBadge band={d.foodCostBand} status={d.status} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{d.unitsSold ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{d.grossProfit != null ? pkr(d.grossProfit) : "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {(d.foodCostBand === "WATCH" || d.foodCostBand === "HIGH") && d.suggestedPrice != null
                          ? pkr(d.suggestedPrice)
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="mt-4 space-y-3 lg:hidden">
            {rows.map((d) => {
              const showMargin = canShowMargin(d.status);
              return (
                <li key={`${d.type}-${d.id}`}>
                  <button
                    type="button"
                    className="w-full rounded-2xl border border-stone-200/80 bg-white p-4 text-left shadow-sm dark:border-stone-700 dark:bg-stone-900"
                    onClick={() => void openRow(d)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-stone-900 dark:text-stone-50">{d.name}</p>
                        <p className="text-xs text-stone-500">{d.category}</p>
                      </div>
                      <BandBadge band={d.foodCostBand} status={d.status} />
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div>
                        <dt className="text-xs text-stone-500">Price</dt>
                        <dd className="tabular-nums font-medium">{pkr(d.price)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-stone-500">Cost</dt>
                        <dd className="tabular-nums font-medium">{formatCostMoney(currencySymbol, d.recipeCostDisplay)}</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-xs text-stone-500">Margin</dt>
                        <dd className="tabular-nums font-medium">
                          {showMargin
                            ? `${formatCostMoney(currencySymbol, d.marginAmount)} (${formatPercent1(d.marginPercent)})`
                            : "Not reliable — check recipe"}
                        </dd>
                      </div>
                    </dl>
                  </button>
                </li>
              );
            })}
          </ul>

          {total > pageSize && (
            <div className="-mx-4 mt-4 border-t border-stone-100 px-4 pt-3 dark:border-stone-800">
              <Pagination
                docked
                page={page}
                totalPages={totalPages}
                totalItems={total}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                onPageChange={(p) => setParam("page", String(p))}
              />
            </div>
          )}
          </AdminPanel>
        </>
      )}

      <DishCostingWhatIf
        open={whatIfOpen}
        onClose={() => setWhatIfOpen(false)}
        currencySymbol={currencySymbol}
        targetFoodCostPercent={target}
      />

      <DishCostingDetailSheet
        open={Boolean(selected)}
        onClose={() => {
          setSelected(null);
          setDetail(null);
        }}
        row={selected}
        detail={detail ? { ...detail, meta: { targetFoodCostPercent: target } } : null}
        currencySymbol={currencySymbol}
      />
    </AdminPage>
  );
}
