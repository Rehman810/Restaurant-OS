"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { compactRs } from "@/lib/analytics/helpers";
import { ChartEmpty } from "./AnalyticsUi";
import {
  CHART_COLORS_FALLBACK,
  formatChartValue,
  useBrandChartPalette,
  useChartGradId,
  useChartSeriesColors,
  useChartTheme,
  type ValueFormat,
} from "./chart-theme";

type Slice = { name: string; value: number };

type TooltipPayload = { name: string; value: number; color?: string };

function RichTooltip({
  active,
  payload,
  label,
  format,
  total,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  format: ValueFormat;
  total?: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="min-w-[140px] rounded-2xl border border-stone-200/90 bg-white/95 px-4 py-3 shadow-xl backdrop-blur-md dark:border-stone-600 dark:bg-stone-900/95"
    >
      {label && <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">{label}</p>}
      <ul className="space-y-1.5">
        {payload.map((p) => {
          const pct = total && total > 0 ? Math.round((p.value / total) * 1000) / 10 : null;
          return (
            <li key={p.name} className="flex items-center justify-between gap-4 text-sm">
              <span className="flex items-center gap-2 text-stone-700 dark:text-stone-200">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: p.color ?? CHART_COLORS_FALLBACK[0] }}
                />
                {p.name}
              </span>
              <span className="font-bold tabular-nums text-stone-900 dark:text-stone-50">
                {formatChartValue(p.value, format)}
                {pct != null && <span className="ml-1 text-xs font-medium text-stone-500">({pct}%)</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DonutLegend({ data, total, colors }: { data: Slice[]; total: number; colors: string[] }) {
  return (
    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
      {data.map((d, i) => {
        const pct = total > 0 ? Math.round((d.value / total) * 1000) / 10 : 0;
        return (
          <li
            key={d.name}
            className="flex items-center justify-between gap-2 rounded-xl bg-stone-50/80 px-3 py-2 dark:bg-stone-800/50"
          >
            <span className="flex min-w-0 items-center gap-2 text-sm text-stone-700 dark:text-stone-300">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white dark:ring-stone-900"
                style={{ background: colors[i % colors.length] }}
              />
              <span className="truncate">{d.name}</span>
            </span>
            <span className="shrink-0 text-xs font-bold tabular-nums text-stone-900 dark:text-stone-100">
              {pct}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function AnalyticsDonut({
  title,
  data,
  format = "number",
  height = 240,
  centerLabel,
}: {
  title?: string;
  data: Slice[];
  format?: ValueFormat;
  height?: number;
  centerLabel?: string;
}) {
  const series = useChartSeriesColors();
  const filtered = data.filter((d) => d.value > 0);
  const total = filtered.reduce((s, d) => s + d.value, 0);

  if (!filtered.length || total <= 0) {
    return <ChartEmpty />;
  }

  const centerText =
    centerLabel ??
    (format === "money" ? formatChartValue(total, "money") : format === "percent" ? `${total}%` : String(total));

  return (
    <div>
      {title && <p className="mb-3 text-sm font-semibold text-stone-700 dark:text-stone-300">{title}</p>}
      <div style={{ height }} className="relative w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={filtered}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="82%"
              paddingAngle={3}
              stroke="none"
            >
              {filtered.map((_, i) => (
                <Cell key={i} fill={series[i % series.length]} className="drop-shadow-sm" />
              ))}
              <Label
                content={({ viewBox }) => {
                  if (!viewBox || !("cx" in viewBox)) return null;
                  const { cx, cy } = viewBox as { cx: number; cy: number };
                  return (
                    <g>
                      <text x={cx} y={cy - 6} textAnchor="middle" fill="#78716c" fontSize={10} fontWeight={600}>
                        TOTAL
                      </text>
                      <text x={cx} y={cy + 14} textAnchor="middle" fill="currentColor" fontSize={15} fontWeight={700}>
                        {centerText.length > 14 ? centerText.slice(0, 12) + "…" : centerText}
                      </text>
                    </g>
                  );
                }}
                position="center"
              />
            </Pie>
            <Tooltip
              content={({ active, payload }) => (
                <RichTooltip
                  active={active}
                  format={format}
                  total={total}
                  payload={payload?.map((p) => ({
                    name: String(p.name),
                    value: Number(p.value),
                    color: p.payload?.fill,
                  }))}
                />
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <DonutLegend data={filtered} total={total} colors={series} />
    </div>
  );
}

export function AnalyticsHBar({
  title,
  data,
  dataKey = "value",
  nameKey = "name",
  format = "number",
  height,
  compact = false,
  className = "",
}: {
  title?: string;
  data: Slice[];
  dataKey?: string;
  nameKey?: string;
  format?: "number" | "money";
  height?: number;
  compact?: boolean;
  className?: string;
}) {
  const theme = useChartTheme();
  const palette = useBrandChartPalette();
  const gradId = useChartGradId("hbar");
  const rows = data.filter((d) => d.value > 0).slice(0, compact ? 6 : 12);
  const rowH = compact ? 32 : 40;
  const h = height ?? Math.min(compact ? 200 : 340, Math.max(compact ? 72 : 180, rows.length * rowH));

  if (!rows.length) return <ChartEmpty />;

  const chartData = rows.map((r) => ({ [nameKey]: r.name, [dataKey]: r.value }));
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div className={className}>
      {title && (
        <p className={`mb-2 font-semibold text-stone-700 dark:text-stone-300 ${compact ? "text-xs" : "text-sm"}`}>
          {title}
        </p>
      )}
      <div style={{ height: h }} className="w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 2, right: compact ? 8 : 16, left: 0, bottom: 2 }}
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={palette.light} />
                <stop offset="100%" stopColor={palette.accent} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke={theme.grid} />
            <XAxis
              type="number"
              domain={[0, max * 1.05]}
              tick={{ fontSize: compact ? 10 : 11, fill: theme.tick }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              tickFormatter={(v) =>
                format === "money" ? compactRs(Number(v)) : String(Math.round(Number(v)))
              }
            />
            <YAxis
              type="category"
              dataKey={nameKey}
              width={compact ? 88 : 108}
              tick={{ fontSize: compact ? 10 : 11, fill: theme.tick }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: theme.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}
              content={({ active, payload, label }) => (
                <RichTooltip
                  active={active}
                  label={String(label)}
                  format={format}
                  payload={payload?.map((p) => ({
                    name: String(p.name ?? label),
                    value: Number(p.value),
                  }))}
                />
              )}
            />
            <Bar
              dataKey={dataKey}
              fill={`url(#${gradId})`}
              radius={[0, 8, 8, 0]}
              maxBarSize={compact ? 18 : 26}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function AnalyticsVBar({
  title,
  data,
  format = "number",
  height = 240,
  compact = false,
}: {
  title?: string;
  data: Slice[];
  format?: "number" | "money";
  height?: number;
  compact?: boolean;
}) {
  const theme = useChartTheme();
  const series = useChartSeriesColors();
  const rows = data.filter((d) => d.value > 0);

  if (!rows.length) return <ChartEmpty />;

  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div>
      {title && (
        <p className={`mb-2 font-semibold text-stone-700 dark:text-stone-300 ${compact ? "text-xs" : "text-sm"}`}>
          {title}
        </p>
      )}
      <div style={{ height: compact ? height ?? 180 : height }} className="w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={theme.grid} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: compact ? 10 : 11, fill: theme.tick }}
              interval={0}
              angle={rows.length > 5 ? -22 : 0}
              textAnchor={rows.length > 5 ? "end" : "middle"}
              height={rows.length > 5 ? (compact ? 48 : 56) : compact ? 28 : 32}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: compact ? 10 : 11, fill: theme.tick }}
              allowDecimals={false}
              width={compact ? 40 : 44}
              domain={[0, max * 1.08]}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) =>
                format === "money" ? compactRs(Number(v)) : String(Math.round(Number(v)))
              }
            />
            <Tooltip
              cursor={{ fill: theme.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}
              content={({ active, payload, label }) => (
                <RichTooltip
                  active={active}
                  label={String(label)}
                  format={format}
                  payload={payload?.map((p) => ({ name: String(p.name ?? "Value"), value: Number(p.value) }))}
                />
              )}
            />
            <Bar dataKey="value" radius={[10, 10, 4, 4]} maxBarSize={48}>
              {rows.map((_, i) => (
                <Cell key={i} fill={series[i % series.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function AnalyticsKpiBars({
  items,
}: {
  items: { label: string; value: number; format?: "money" | "number" }[];
}) {
  const theme = useChartTheme();
  const palette = useBrandChartPalette();
  const gradId = useChartGradId("kpi");
  const data = useMemo(
    () => items.map((i) => ({ name: i.label, value: i.value, format: i.format })),
    [items]
  );
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="h-[220px] w-full min-w-0 rounded-2xl bg-gradient-to-b from-stone-50/80 to-transparent p-2 dark:from-stone-800/30">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 12, left: 4, bottom: 8 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={palette.accent} />
              <stop offset="100%" stopColor={palette.light} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={theme.grid} />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: theme.tick, fontWeight: 600 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: theme.tick }} allowDecimals={false} width={52} domain={[0, max * 1.1]} axisLine={false} tickLine={false} />
          <Tooltip
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as { name: string; value: number; format?: string };
              if (!active || !row) return null;
              return (
                <RichTooltip
                  active
                  format={row.format === "money" ? "money" : "number"}
                  payload={[{ name: row.name, value: row.value }]}
                />
              );
            }}
          />
          <Bar dataKey="value" fill={`url(#${gradId})`} radius={[12, 12, 4, 4]} maxBarSize={56} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
