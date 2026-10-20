"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  Clock,
  Download,
  Layers,
  LineChart,
  Package,
  PieChart,
  Printer,
  ShoppingBag,
  Star,
  Tag,
  Users,
  Wallet,
} from "lucide-react";
import { AdminAlert, AdminEmptyState, AdminPage, AdminPageHeader } from "@/components/admin/ui";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { useAnalyticsOverview } from "@/hooks/useAnalyticsOverview";
import type { AnalyticsPreset, CompareMode } from "@/lib/analytics/types";
import {
  activeChartSlices,
  compactRs,
  formatDeltaDisplay,
  formatRangeSubtitle,
  hasHeatmapActivity,
  heatmapTopSlots,
  pluralizeCustomers,
} from "@/lib/analytics/helpers";
import { pkr } from "@/lib/format";
import { STATUS_LABEL, type OrderStatus } from "@/lib/types";
import { getApiUrl } from "@/lib/api";
import { AnalyticsDonut, AnalyticsHBar, AnalyticsVBar } from "./AnalyticsShareCharts";
import {
  AnalyticsChartPanel,
  AnalyticsFilterChip,
  AnalyticsInsightCard,
  AnalyticsKpiCard,
  AnalyticsSegControl,
} from "./AnalyticsUi";

const COMPLETED_STATUSES = new Set(["DELIVERED", "COLLECTED", "SERVED"]);

const TrendChart = dynamic(() => import("./AnalyticsTrendChart").then((m) => m.AnalyticsTrendChart), {
  ssr: false,
  loading: () => <div className="skeleton h-48 rounded-2xl" />,
});

const Heatmap = dynamic(() => import("./AnalyticsHeatmap").then((m) => m.AnalyticsHeatmap), {
  ssr: false,
  loading: () => <div className="skeleton h-40 rounded-2xl" />,
});

const PRESETS: { id: AnalyticsPreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "this_week", label: "This week" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "last_30", label: "Last 30 days" },
  { id: "this_year", label: "This year" },
  { id: "custom", label: "Custom" },
];

const METRIC_HELP: Record<string, string> = {
  Collected: "Revenue from completed orders (delivered, picked up, or served) placed in this period.",
  Booked: "Total value of non-cancelled orders placed in this period.",
  "Avg order value": "Collected revenue divided by completed order count.",
};

const KPI_ACCENTS = ["orange", "orange", "teal", "teal", "violet", "slate"] as const;

export function AdminAnalyticsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const preset = (searchParams.get("preset") as AnalyticsPreset) || "this_month";
  const compare = (searchParams.get("compare") as CompareMode) || "previous";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";

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

  const { data, loading, refreshing, error, refresh } = useAnalyticsOverview({
    preset,
    from: preset === "custom" ? from : undefined,
    to: preset === "custom" ? to : undefined,
    compare,
  });

  const showFinancials = data?.kpis.booked != null;
  const [trendMetric, setTrendMetric] = useState<"orders" | "booked" | "collected">("collected");
  const [heatmapMode, setHeatmapMode] = useState<"orders" | "revenue">("orders");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [itemsExtrasOpen, setItemsExtrasOpen] = useState(false);

  const chartSlices = useMemo(() => {
    if (!data) return null;
    const completed = data.statuses
      .filter((s) => COMPLETED_STATUSES.has(s.status))
      .reduce((sum, s) => sum + s.count, 0);
    const cancelled = data.statuses.find((s) => s.status === "CANCELLED")?.count ?? 0;
    const inProgress = data.statuses
      .filter((s) => !COMPLETED_STATUSES.has(s.status) && s.status !== "CANCELLED")
      .reduce((sum, s) => sum + s.count, 0);
    const statusBars = data.statuses
      .filter((s) => s.count > 0)
      .map((s) => ({
        name: STATUS_LABEL[s.status as OrderStatus] ?? s.status,
        value: s.count,
      }));
    const channelSlices =
      data.channels?.sources.map((c) => ({ name: c.label, value: c.orders })) ?? [];
    const fulfillmentSlices =
      data.channels?.fulfillment.map((c) => ({ name: c.label, value: c.orders })) ?? [];
    const paymentSlices = data.payments?.map((p) => ({ name: p.label, value: p.amount })) ?? [];
    const categorySlices = data.categories?.map((c) => ({ name: c.category, value: c.revenue })) ?? [];
    const itemSlices =
      data.items?.rows.slice(0, 10).map((r) => ({ name: r.name, value: r.revenue })) ?? [];
    const cancelReasons =
      data.cancellations.reasons.map((r) => ({ name: r.reason, value: r.count })) ?? [];
    const customerMix = data.customers
      ? [
          { name: "New", value: data.customers.newCount },
          { name: "Returning", value: data.customers.returningCount },
        ]
      : [];
    const frequencyBars =
      data.customers?.frequency.map((f) => ({ name: f.bucket, value: f.count })) ?? [];
    const feedbackBars = (data.feedback.distribution ?? []).map((d) => ({
      name: `${d.rating}★`,
      value: d.count,
    }));
    const riderBars =
      data.operations?.riders.slice(0, 8).map((r) => ({ name: r.name, value: r.deliveries })) ?? [];
    const areaBars =
      data.operations?.areas.slice(0, 8).map((a) => ({ name: a.name, value: a.orders })) ?? [];
    const couponBars =
      data.promotions?.topCoupons.map((c) => ({ name: c.code, value: c.uses })) ?? [];
    const staffBars =
      data.control?.byStaff.map((s) => ({
        name: s.name,
        value: Math.round((s.voidValue + s.discountValue) * 100) / 100,
      })) ?? [];
    return {
      outcomes: [
        { name: "Completed", value: completed },
        { name: "Cancelled", value: cancelled },
        { name: "In progress", value: inProgress },
      ],
      statusBars,
      channelSlices,
      fulfillmentSlices,
      paymentSlices,
      categorySlices,
      itemSlices,
      cancelReasons,
      customerMix,
      frequencyBars,
      feedbackBars,
      riderBars,
      areaBars,
      couponBars,
      staffBars,
    };
  }, [data]);

  const chartRelevance = useMemo(() => {
    if (!data || !chartSlices) return null;
    const orders = data.kpis.ordersCount.value;
    const channels = activeChartSlices(chartSlices.channelSlices);
    const payments = activeChartSlices(chartSlices.paymentSlices);
    const fulfillment = activeChartSlices(chartSlices.fulfillmentSlices);
    const categories = activeChartSlices(chartSlices.categorySlices);
    const outcomes = activeChartSlices(chartSlices.outcomes);
    const customerMix = activeChartSlices(chartSlices.customerMix);
    const freqActive = activeChartSlices(chartSlices.frequencyBars);
    return {
      trend: (data.series?.buckets.length ?? 0) > 0,
      heatmap: Boolean(data.heatmap && hasHeatmapActivity(data.heatmap.orders)),
      outcomes: orders > 0,
      showOutcomeDonut: outcomes.length >= 2,
      showStatusBreakdown: chartSlices.statusBars.length >= 3,
      cancelReasons: data.cancellations.count > 0 && chartSlices.cancelReasons.length > 0,
      showChannels: showFinancials && channels.length >= 2,
      showPayments: showFinancials && payments.length >= 1,
      showFulfillment: showFinancials && fulfillment.length >= 2,
      items: chartSlices.itemSlices.length > 0,
      categories: categories.length >= 2,
      customers:
        data.kpis.uniqueCustomers.value > 0 &&
        Boolean(data.customers && data.customers.newCount + data.customers.returningCount > 0),
      customerMix: customerMix.length >= 2,
      customerFrequency: freqActive.length >= 2,
      topSpenders: (data.customers?.topCustomers.length ?? 0) > 0,
      operations:
        orders >= 3 &&
        (chartSlices.riderBars.length > 0 || chartSlices.areaBars.length > 0),
      promotions: Boolean(showFinancials && data.promotions && data.promotions.redemptions > 0),
      control: Boolean(
        showFinancials &&
          data.control &&
          (data.control.voids.count > 0 ||
            data.control.refunds.count > 0 ||
            data.control.discounts.count > 0 ||
            chartSlices.staffBars.length > 0)
      ),
      feedback: data.feedback.count > 0,
      profit: Boolean(
        showFinancials &&
          data.profit &&
          data.profit.collected > 0 &&
          (data.profit.coveragePercent >= 10 || data.profit.grossProfit > 0)
      ),
    };
  }, [chartSlices, data, showFinancials]);

  const insights = useMemo(() => {
    if (!data?.meta.enoughData.insights || !data.heatmap) return null;
    const top = heatmapTopSlots(data.heatmap.orders, data.heatmap.weekdayLabels, 1)[0];
    const bestHour = top?.orders ? top : null;
    const byDow = data.heatmap.weekdayLabels.map((label, i) => ({
      label,
      orders: data.heatmap!.orders[i].reduce((s, n) => s + n, 0),
    }));
    const bestDow = [...byDow].sort((a, b) => b.orders - a.orders)[0];
    const topChannel = data.channels?.sources[0];
    const topMover = data.items?.rows.find((r) => r.quantity > 0);
    return { bestHour, bestDow, topChannel, topMover, late: data.operations?.latePercent };
  }, [data]);

  async function exportCsv() {
    const p = new URLSearchParams(searchParams.toString());
    const token = localStorage.getItem("uff_token");
    const res = await fetch(`${getApiUrl()}/admin/analytics/export.csv?${p}`, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "analytics-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const subtitle = data
    ? formatRangeSubtitle(data.meta.range.fromKey, data.meta.range.toKey, data.meta.timezone)
    : "Loading…";

  const kpiCards: { label: string; value: string; delta: ReturnType<typeof formatDeltaDisplay>; help?: string; accent: typeof KPI_ACCENTS[number] }[] = [];
  if (data) {
    let i = 0;
    if (showFinancials && data.kpis.collected) {
      kpiCards.push({
        label: "Collected",
        value: compactRs(data.kpis.collected.value),
        help: METRIC_HELP.Collected,
        delta: formatDeltaDisplay(data.kpis.collected.deltaPercent, data.kpis.collected.deltaLabel),
        accent: KPI_ACCENTS[i++ % KPI_ACCENTS.length],
      });
    }
    if (showFinancials && data.kpis.booked) {
      kpiCards.push({
        label: "Booked",
        value: compactRs(data.kpis.booked.value),
        help: METRIC_HELP.Booked,
        delta: formatDeltaDisplay(data.kpis.booked.deltaPercent, data.kpis.booked.deltaLabel),
        accent: KPI_ACCENTS[i++ % KPI_ACCENTS.length],
      });
    }
    kpiCards.push(
      {
        label: "Orders",
        value: String(data.kpis.ordersCount.value),
        delta: formatDeltaDisplay(data.kpis.ordersCount.deltaPercent, data.kpis.ordersCount.deltaLabel),
        accent: KPI_ACCENTS[i++ % KPI_ACCENTS.length],
      },
      {
        label: "Completed",
        value: String(data.kpis.completedCount.value),
        delta: formatDeltaDisplay(data.kpis.completedCount.deltaPercent, data.kpis.completedCount.deltaLabel),
        accent: KPI_ACCENTS[i++ % KPI_ACCENTS.length],
      }
    );
    if (showFinancials && data.kpis.avgOrderValue) {
      kpiCards.push({
        label: "Avg order value",
        value: pkr(data.kpis.avgOrderValue.value),
        help: METRIC_HELP["Avg order value"],
        delta: formatDeltaDisplay(data.kpis.avgOrderValue.deltaPercent, data.kpis.avgOrderValue.deltaLabel),
        accent: KPI_ACCENTS[i++ % KPI_ACCENTS.length],
      });
    }
    kpiCards.push({
      label: "Customers",
      value: pluralizeCustomers(data.kpis.uniqueCustomers.value),
      delta: formatDeltaDisplay(data.kpis.uniqueCustomers.deltaPercent, data.kpis.uniqueCustomers.deltaLabel),
      accent: KPI_ACCENTS[i++ % KPI_ACCENTS.length],
    });
  }

  return (
    <AdminPage
      data-testid="admin-analytics"
      className="analytics-print pb-24 print:pb-0 bg-gradient-to-b from-[#fff6ed] via-[#fffaf5] to-stone-100/80 dark:from-stone-950 dark:via-stone-950 dark:to-stone-900"
    >
      <div className="print:hidden sticky top-0 z-20 -mx-4 border-b border-stone-200/60 bg-[#fffaf5]/90 px-4 py-3 backdrop-blur-xl dark:border-stone-800 dark:bg-stone-950/90 sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <AdminPageHeader
          title="Analytics"
          description={subtitle}
          icon={BarChart3}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="hidden min-h-11 items-center gap-2 rounded-xl border border-stone-200 px-3 text-sm font-semibold lg:inline-flex dark:border-stone-600"
                onClick={() => void exportCsv()}
              >
                <Download size={16} /> Export
              </button>
              <button
                type="button"
                className="hidden min-h-11 items-center gap-2 rounded-xl border border-stone-200 px-3 text-sm font-semibold lg:inline-flex dark:border-stone-600"
                onClick={() => window.print()}
              >
                <Printer size={16} /> Print
              </button>
              <RefreshButton busy={loading || refreshing} onClick={refresh} />
            </div>
          }
        />
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {PRESETS.map((p) => (
            <AnalyticsFilterChip key={p.id} active={preset === p.id} onClick={() => setQuery({ preset: p.id })}>
              {p.label}
            </AnalyticsFilterChip>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wide text-stone-500">Compare</span>
          <AnalyticsSegControl
            size="sm"
            value={compare}
            onChange={(c) => setQuery({ compare: c })}
            options={[
              { id: "previous", label: "Previous" },
              { id: "lastYear", label: "Last year" },
              { id: "none", label: "Off" },
            ]}
          />
          <button
            type="button"
            className="ml-auto min-h-11 rounded-xl border border-stone-200 px-3 text-sm font-semibold lg:hidden dark:border-stone-600"
            onClick={() => setMobileFiltersOpen((o) => !o)}
          >
            More
          </button>
        </div>
        {preset === "custom" && (
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="date"
              className="min-h-11 rounded-xl border border-stone-200 px-3 dark:border-stone-600 dark:bg-stone-900"
              value={from}
              onChange={(e) => setQuery({ from: e.target.value })}
            />
            <input
              type="date"
              className="min-h-11 rounded-xl border border-stone-200 px-3 dark:border-stone-600 dark:bg-stone-900"
              value={to}
              onChange={(e) => setQuery({ to: e.target.value })}
            />
          </div>
        )}
        {mobileFiltersOpen && (
          <div className="mt-2 flex gap-2 lg:hidden">
            <button type="button" className="min-h-11 flex-1 rounded-xl border font-semibold" onClick={() => void exportCsv()}>
              Export CSV
            </button>
            <button type="button" className="min-h-11 flex-1 rounded-xl border font-semibold" onClick={() => window.print()}>
              Print
            </button>
          </div>
        )}
        {data?.meta.generatedAt && (
          <p className="mt-1 text-xs text-stone-500" aria-live="polite">
            Data as of {new Date(data.meta.generatedAt).toLocaleTimeString()}
          </p>
        )}
      </div>

      {error && (
        <AdminAlert variant="error">
          <span className="flex flex-wrap items-center gap-2">
            {error}
            <button type="button" className="font-semibold underline" onClick={() => void refresh()}>
              Retry
            </button>
          </span>
        </AdminAlert>
      )}

      {loading && !data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
      ) : data ? (
        <div className={`space-y-6 ${refreshing ? "opacity-80 transition-opacity" : ""}`}>
          {!data.meta.enoughData.trends && (
            <AdminAlert variant="info">
              Only {data.meta.dataDays} day{data.meta.dataDays === 1 ? "" : "s"} of data so far; trends are clearer after about a week.
            </AdminAlert>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {kpiCards.map((k) => (
              <AnalyticsKpiCard
                key={k.label}
                label={k.label}
                value={k.value}
                help={k.help}
                accent={k.accent}
                delta={k.delta}
                showComparison={compare !== "none"}
              />
            ))}
          </div>

          {insights && data.meta.enoughData.insights && (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {insights.bestHour && (
                <AnalyticsInsightCard
                  variant="highlight"
                  title="Best hour"
                  body={`${insights.bestHour.label} had ${insights.bestHour.orders} orders in this period.`}
                />
              )}
              {insights.bestDow && insights.bestDow.orders > 0 && (
                <AnalyticsInsightCard
                  title="Best weekday"
                  body={`${insights.bestDow.label} — ${insights.bestDow.orders} orders.`}
                />
              )}
              {insights.topChannel && (
                <AnalyticsInsightCard
                  title="Busiest channel"
                  body={`${insights.topChannel.label} (${insights.topChannel.share}% of orders).`}
                />
              )}
            </div>
          )}

          {chartRelevance?.trend && (
          <AnalyticsChartPanel
            title="Sales trend"
            subtitle="Orders and revenue over time"
            icon={LineChart}
            accent="orange"
            headerExtra={
              <AnalyticsSegControl
                size="sm"
                value={trendMetric}
                onChange={setTrendMetric}
                options={[
                  { id: "orders", label: "Orders" },
                  { id: "booked", label: "Booked" },
                  { id: "collected", label: "Collected" },
                ].filter((o) => o.id === "orders" || showFinancials) as { id: "orders" | "booked" | "collected"; label: string }[]}
              />
            }
          >
            {data.series?.buckets.length ? (
              <>
                <TrendChart buckets={data.series.buckets} metric={trendMetric} compare={compare !== "none"} />
                <p className="sr-only">
                  Trend chart showing {trendMetric} for {data.series.buckets.length} periods.
                </p>
              </>
            ) : (
              <AdminEmptyState icon={BarChart3} title="No trend data" description="Try a wider date range." />
            )}
          </AnalyticsChartPanel>
          )}

          {chartRelevance?.heatmap && data.heatmap && (
            <AnalyticsChartPanel
              title="Busy hours"
              subtitle="When customers order most"
              icon={Clock}
              accent="teal"
              headerExtra={
                showFinancials && data.heatmap.revenue ? (
                  <AnalyticsSegControl
                    size="sm"
                    value={heatmapMode}
                    onChange={setHeatmapMode}
                    options={[
                      { id: "orders", label: "Orders" },
                      { id: "revenue", label: "Revenue" },
                    ]}
                  />
                ) : undefined
              }
            >
              <Heatmap
                orders={data.heatmap.orders}
                weekdayLabels={data.heatmap.weekdayLabels}
                showRevenue={heatmapMode === "revenue"}
                revenue={data.heatmap.revenue}
              />
            </AnalyticsChartPanel>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {chartRelevance?.outcomes && chartSlices && (
            <AnalyticsChartPanel
              title="Order outcomes"
              subtitle={`Completion ${data.outcomes.completionRate}% · Cancelled ${data.outcomes.cancellationRate}%${showFinancials ? ` · Lost ${pkr(data.outcomes.lostRevenue)}` : ""}`}
              icon={PieChart}
              accent="violet"
            >
              {chartRelevance.showOutcomeDonut && (
                <AnalyticsDonut data={chartSlices.outcomes} />
              )}
              {chartRelevance.showStatusBreakdown && (
                <AnalyticsHBar title="Status breakdown" data={chartSlices.statusBars} />
              )}
              {!chartRelevance.showOutcomeDonut && !chartRelevance.showStatusBreakdown && (
                <AnalyticsHBar data={chartSlices.statusBars} />
              )}
              {chartRelevance.cancelReasons && (
                <div className="mt-6 border-t border-stone-200/60 pt-6 dark:border-stone-700">
                  <AnalyticsHBar title="Cancellation reasons" data={chartSlices.cancelReasons} />
                </div>
              )}
            </AnalyticsChartPanel>
            )}

            {chartSlices &&
              (chartRelevance?.showChannels || chartRelevance?.showPayments || chartRelevance?.showFulfillment) && (
              <AnalyticsChartPanel
                title="Channels & payments"
                subtitle="Only shown when you have enough mix to compare"
                icon={Wallet}
                accent="teal"
              >
                <div className="grid gap-6 sm:grid-cols-2">
                  {chartRelevance.showChannels && (
                    <AnalyticsDonut title="Sales channel" data={chartSlices.channelSlices} />
                  )}
                  {chartRelevance.showFulfillment && (
                    <AnalyticsDonut title="Fulfillment type" data={chartSlices.fulfillmentSlices} />
                  )}
                  {chartRelevance.showPayments && !chartRelevance.showChannels && (
                    <AnalyticsDonut title="Payments" data={chartSlices.paymentSlices} format="money" />
                  )}
                </div>
                {chartRelevance.showPayments && chartRelevance.showChannels && (
                  <div className="mt-6 border-t border-stone-200/60 pt-6 dark:border-stone-700">
                    <AnalyticsDonut title="Payments" data={chartSlices.paymentSlices} format="money" />
                  </div>
                )}
              </AnalyticsChartPanel>
            )}
          </div>

          {chartRelevance?.items && data.items && chartSlices && (
            <AnalyticsChartPanel title="Menu performance" subtitle="Top sellers by revenue" icon={Package} accent="orange">
              <AnalyticsHBar title="Top items by revenue" data={chartSlices.itemSlices} format="money" />
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer font-semibold text-brand-700 dark:text-brand-300">View table</summary>
                <table className="mt-3 w-full">
                  <thead>
                    <tr className="text-left text-stone-500">
                      <th className="py-2">Item</th>
                      <th>Qty</th>
                      <th>Revenue</th>
                      <th>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.rows.map((r) => (
                      <tr key={r.name} className="border-t border-stone-100 dark:border-stone-800">
                        <td className="py-2 font-medium">{r.name}</td>
                        <td>{r.quantity}</td>
                        <td>{pkr(r.revenue)}</td>
                        <td>{r.share}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
              {(data.items.dead.length > 0 || data.items.slowMovers.length > 0) && (
                <div className="mt-4 border-t border-stone-100 pt-3 dark:border-stone-800">
                  <button
                    type="button"
                    className="text-sm font-semibold text-brand-700 dark:text-brand-300"
                    onClick={() => setItemsExtrasOpen((o) => !o)}
                  >
                    {itemsExtrasOpen ? "Hide" : "Show"} dead & slow movers
                  </button>
                  {itemsExtrasOpen && (
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      {data.items.dead.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold">No sales this period</p>
                          <ul className="mt-2 text-sm text-stone-600 dark:text-stone-400">
                            {data.items.dead.map((d) => (
                              <li key={d.menuItemId}>{d.name}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {data.items.slowMovers.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold">Slow movers</p>
                          <ul className="mt-2 text-sm text-stone-600 dark:text-stone-400">
                            {data.items.slowMovers.map((s) => (
                              <li key={s.menuItemId}>
                                {s.name} ({s.quantity})
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </AnalyticsChartPanel>
          )}

          {chartRelevance?.categories && data.categories && chartSlices && (
            <AnalyticsChartPanel title="Categories" subtitle="Revenue by menu category" icon={Layers} accent="teal">
              {activeChartSlices(chartSlices.categorySlices).length >= 4 ? (
                <AnalyticsVBar data={chartSlices.categorySlices} format="money" height={280} />
              ) : (
                <AnalyticsDonut data={chartSlices.categorySlices} format="money" />
              )}
            </AnalyticsChartPanel>
          )}

          {chartRelevance?.customers && data.customers && chartSlices && (
            <AnalyticsChartPanel
              title="Customers"
              subtitle={`Repeat rate ${data.customers.repeatRate}% · avg ${data.customers.avgOrdersPerCustomer} orders per customer`}
              icon={Users}
              accent="violet"
            >
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                {chartRelevance.customerMix && (
                  <AnalyticsDonut title="New vs returning" data={chartSlices.customerMix} />
                )}
                {chartRelevance.customerFrequency && (
                  <AnalyticsVBar title="Orders per customer" data={chartSlices.frequencyBars} />
                )}
              </div>
              {chartRelevance.topSpenders && data.customers.topCustomers.length > 0 && (
                <div className="mt-4">
                  <AnalyticsHBar
                    title="Top spenders"
                    data={data.customers.topCustomers.map((c) => ({ name: c.name, value: c.spend }))}
                    format="money"
                  />
                </div>
              )}
            </AnalyticsChartPanel>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {chartRelevance?.operations && data.operations && chartSlices && (
              <AnalyticsChartPanel
                compact
                title="Operations"
                subtitle={`Prep ${data.operations.avgPrepMinutes ?? "—"} min · Late ${data.operations.latePercent}%`}
                icon={ShoppingBag}
                accent="slate"
              >
                {chartSlices.riderBars.length > 0 && (
                  <AnalyticsHBar compact title="By rider" data={chartSlices.riderBars} />
                )}
                {chartSlices.areaBars.length > 0 && (
                  <AnalyticsHBar compact title="By area" data={chartSlices.areaBars} className={chartSlices.riderBars.length > 0 ? "mt-3" : ""} />
                )}
              </AnalyticsChartPanel>
            )}

            {chartRelevance?.control && data.control && chartSlices && (
              <AnalyticsChartPanel
                compact
                title="Control"
                subtitle={`Voids ${data.control.voids.count} · Refunds ${data.control.refunds.count} · Discounts ${data.control.discounts.count}`}
                icon={Wallet}
                accent="slate"
              >
                {chartSlices.staffBars.length > 0 && (
                  <AnalyticsHBar compact title="Staff adjustments" data={chartSlices.staffBars} format="money" />
                )}
              </AnalyticsChartPanel>
            )}

            {chartRelevance?.feedback && chartSlices && (
              <AnalyticsChartPanel
                compact
                title="Guest feedback"
                subtitle={`${data.feedback.avgRating ?? "—"} avg · ${data.feedback.count} ratings`}
                icon={Star}
                accent="violet"
              >
                {chartSlices.feedbackBars.length > 0 && (
                  <AnalyticsVBar compact title="Stars" data={chartSlices.feedbackBars} height={160} />
                )}
              </AnalyticsChartPanel>
            )}

            {chartRelevance?.promotions && data.promotions && chartSlices && (
              <AnalyticsChartPanel
                compact
                title="Promotions"
                subtitle={`${data.promotions.redemptions} uses · ${pkr(data.promotions.discountGiven)} off`}
                icon={Tag}
                accent="orange"
              >
                {chartSlices.couponBars.length > 0 && (
                  <AnalyticsVBar compact title="Coupons" data={chartSlices.couponBars} height={160} />
                )}
              </AnalyticsChartPanel>
            )}

            {chartRelevance?.profit && data.profit && (
              <AnalyticsChartPanel
                compact
                title="Gross profit"
                subtitle={`${pkr(data.profit.grossProfit)} · ${data.profit.coveragePercent}% coverage`}
                icon={Wallet}
                accent="teal"
                className="md:col-span-2 xl:col-span-1"
              >
                <AnalyticsVBar
                  compact
                  data={[
                    { name: "Collected", value: data.profit.collected },
                    { name: "Cost", value: data.profit.theoreticalCost },
                    { name: "Profit", value: Math.max(0, data.profit.grossProfit) },
                  ].filter((r) => r.value > 0)}
                  format="money"
                  height={160}
                />
                {data.profit.lowCoverage && (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Low recipe coverage — estimate may be incomplete.</p>
                )}
              </AnalyticsChartPanel>
            )}
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        @media print {
          .analytics-print aside,
          .analytics-print nav,
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </AdminPage>
  );
}
