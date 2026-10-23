"use client";

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { compactRs, niceTicks } from "@/lib/analytics/helpers";
import { useBrandChartPalette, useChartGradId, useChartTheme } from "./chart-theme";
import { useAdminTheme } from "@/hooks/useAdminTheme";

type Bucket = {
  label: string;
  orders: number;
  booked: number | null;
  collected: number | null;
  comparisonOrders: number;
  comparisonBooked: number | null;
  comparisonCollected: number | null;
};

const TREND_SERIES_LABEL: Record<string, string> = {
  value: "Selected period",
  comparison: "Comparison",
};

function TrendTooltip({
  active,
  payload,
  label,
  metric,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number; color: string }[];
  label?: string;
  metric: "orders" | "booked" | "collected";
}) {
  if (!active || !payload?.length) return null;
  const fmt = (v: number) => (metric === "orders" ? `${v} orders` : compactRs(v));
  const seen = new Set<string>();
  const rows = payload.filter((p) => {
    const key = String(p.dataKey);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return (
    <div className="rounded-2xl border border-stone-200/90 bg-white/95 px-4 py-3 shadow-xl backdrop-blur-md dark:border-stone-600 dark:bg-stone-900/95">
      <p className="text-xs font-bold uppercase tracking-wide text-stone-500">{label}</p>
      <ul className="mt-2 space-y-1">
        {rows.map((p) => {
          const key = String(p.dataKey);
          return (
            <li key={key} className="flex items-center justify-between gap-6 text-sm">
              <span className="flex items-center gap-2 text-stone-600 dark:text-stone-300">
                <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                {TREND_SERIES_LABEL[key] ?? key}
              </span>
              <span className="font-bold tabular-nums">{fmt(Number(p.value))}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AnalyticsTrendChart({
  buckets,
  metric,
  compare,
}: {
  buckets: Bucket[];
  metric: "orders" | "booked" | "collected";
  compare: boolean;
}) {
  const theme = useChartTheme();
  const palette = useBrandChartPalette();
  const { theme: adminTheme } = useAdminTheme();
  const barGrad = useChartGradId("trend-bar");
  const areaGrad = useChartGradId("trend-area");

  const data = buckets.map((b) => ({
    label: b.label,
    value: metric === "orders" ? b.orders : metric === "booked" ? (b.booked ?? 0) : (b.collected ?? 0),
    comparison:
      metric === "orders"
        ? b.comparisonOrders
        : metric === "booked"
          ? (b.comparisonBooked ?? 0)
          : (b.comparisonCollected ?? 0),
  }));
  const max = Math.max(...data.map((d) => Math.max(d.value, compare ? d.comparison : 0)), 1);
  const ticks = niceTicks(max);
  const compStroke = adminTheme === "dark" ? "#a8a29e" : "#94a3b8";

  return (
    <div className="h-[min(320px,50vh)] min-h-[240px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 16, right: 12, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id={barGrad} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={palette.light} stopOpacity={0.95} />
              <stop offset="100%" stopColor={palette.accent} stopOpacity={0.85} />
            </linearGradient>
            <linearGradient id={areaGrad} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={palette.mid} stopOpacity={0.25} />
              <stop offset="100%" stopColor={palette.mid} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={theme.grid} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: theme.tick }}
            interval="preserveStartEnd"
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            ticks={ticks}
            allowDecimals={false}
            width={48}
            tick={{ fontSize: 11, fill: theme.tick }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => (metric === "orders" ? String(v) : compactRs(Number(v)))}
          />
          <Tooltip content={<TrendTooltip metric={metric} />} />
          <Area type="monotone" dataKey="value" fill={`url(#${areaGrad})`} stroke="none" />
          <Bar
            dataKey="value"
            name="Selected period"
            fill={`url(#${barGrad})`}
            radius={[8, 8, 2, 2]}
            maxBarSize={36}
          />
          {compare && (
            <Line
              type="monotone"
              dataKey="comparison"
              name="Comparison"
              stroke={compStroke}
              strokeWidth={2.5}
              dot={{ r: 3, fill: compStroke, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      {compare && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs text-stone-500">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm bg-gradient-to-t from-brand-700 to-brand-400" />
            Selected period
          </span>
          <span className="flex items-center gap-2">
            <span className="h-0.5 w-4 rounded bg-stone-400" />
            Comparison
          </span>
        </div>
      )}
    </div>
  );
}
