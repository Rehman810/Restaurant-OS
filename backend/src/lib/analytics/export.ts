import type { AnalyticsOverview } from "./types";
import { buildCsv } from "./csv";

export type CsvSection = "full" | "kpis" | "series" | "items" | "categories" | "customers";

export function csvFromOverview(
  overview: AnalyticsOverview,
  branchLabel: string,
  section: CsvSection = "full"
) {
  const header = [
    ["Analytics export"],
    ["Timezone", overview.meta.timezone],
    ["Period", `${overview.meta.range.fromKey} to ${overview.meta.range.toKey}`],
    ["Branch", branchLabel],
    ["Generated", overview.meta.generatedAt],
    [],
  ];

  const kpiRows: string[][] = [["Metric", "Value", "Previous", "Delta %"]];
  const pushKpi = (name: string, m: { value: number; previous: number; deltaPercent: number | null } | null) => {
    if (!m) return;
    kpiRows.push([name, String(m.value), String(m.previous), m.deltaPercent == null ? "" : String(m.deltaPercent)]);
  };
  pushKpi("Booked", overview.kpis.booked);
  pushKpi("Collected", overview.kpis.collected);
  pushKpi("Orders", overview.kpis.ordersCount);
  pushKpi("Completed", overview.kpis.completedCount);

  const seriesRows: string[][] = [["Date", "Orders", "Booked", "Collected"]];
  for (const b of overview.series?.buckets ?? []) {
    seriesRows.push([b.label, String(b.orders), String(b.booked ?? ""), String(b.collected ?? "")]);
  }

  const itemRows: string[][] = [["Item", "Category", "Qty", "Revenue", "Share %"]];
  for (const r of overview.items?.rows ?? []) {
    itemRows.push([r.name, r.category, String(r.quantity), String(r.revenue), String(r.share)]);
  }

  const catRows: string[][] = [["Category", "Qty", "Revenue", "Share %"]];
  for (const c of overview.categories ?? []) {
    catRows.push([c.category, String(c.quantity), String(c.revenue), String(c.share)]);
  }

  const customerRows: string[][] = [["Name", "Phone", "Orders", "Spend"]];
  for (const c of overview.customers?.topCustomers ?? []) {
    customerRows.push([c.name, c.phone ?? "", String(c.orders), String(c.spend)]);
  }

  const blocks: string[][] = [...header];
  if (section === "full" || section === "kpis") {
    blocks.push(["KPIs"], ...kpiRows, []);
  }
  if (section === "full" || section === "series") {
    blocks.push(["Daily series"], ...seriesRows, []);
  }
  if (section === "full" || section === "items") {
    blocks.push(["Items"], ...itemRows, []);
  }
  if (section === "full" || section === "categories") {
    blocks.push(["Categories"], ...catRows, []);
  }
  if (section === "full" || section === "customers") {
    blocks.push(["Top customers"], ...customerRows, []);
  }
  return buildCsv(blocks);
}
