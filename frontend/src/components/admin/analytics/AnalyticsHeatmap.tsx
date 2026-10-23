"use client";

import { Fragment } from "react";
import { compactRs, formatHeatmapHour, formatHeatmapHourAxis } from "@/lib/analytics/helpers";
import { brandHeatColor, useBrandChartPalette } from "./chart-theme";

type Props = {
  orders: number[][];
  weekdayLabels: string[];
  showRevenue?: boolean;
  revenue?: number[][] | null;
};

export function AnalyticsHeatmap({ orders, weekdayLabels, showRevenue, revenue }: Props) {
  const grid = showRevenue && revenue ? revenue : orders;
  const max = Math.max(0, ...grid.flat());
  const hours = grid[0]?.length ?? 24;
  const palette = useBrandChartPalette();
  const { isDark, rgb, accentRgb, paleRgb, accent, pale } = palette;

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-stone-200/60 bg-stone-50/50 p-3 dark:border-stone-700 dark:bg-stone-800/30">
        <div className="inline-block min-w-full">
          <div className="grid grid-cols-[2.75rem_repeat(24,minmax(1.1rem,1fr))] gap-1 text-[10px] sm:gap-1.5 sm:text-xs">
            <div />
            {Array.from({ length: hours }, (_, h) => (
              <div key={h} className="text-center font-medium text-stone-400" aria-hidden>
                {h % 3 === 0 ? formatHeatmapHourAxis(h) : ""}
              </div>
            ))}
            {weekdayLabels.map((label, d) => (
              <Fragment key={label}>
                <div className="flex items-center text-xs font-bold text-stone-600 dark:text-stone-400">{label}</div>
                {Array.from({ length: hours }, (_, h) => {
                  const v = grid[d]?.[h] ?? 0;
                  const t = max > 0 ? v / max : 0;
                  return (
                    <div
                      key={`${d}-${h}`}
                      title={
                        showRevenue
                          ? `${label} ${formatHeatmapHour(h)} — ${compactRs(v)}`
                          : `${label} ${formatHeatmapHour(h)} — ${v} orders`
                      }
                      className="aspect-square rounded-md shadow-sm ring-1 ring-black/5 transition-transform hover:scale-110 hover:z-10 dark:ring-white/5"
                      style={{ background: brandHeatColor(t, isDark, rgb, accentRgb, paleRgb) }}
                      aria-label={`${label} ${formatHeatmapHour(h)}, ${v} ${showRevenue ? "revenue" : "orders"}`}
                    />
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-stone-500">
          Busier hours glow warmer ({showRevenue ? "revenue" : "orders"}).
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-stone-400">Low</span>
          <div
            className="h-2 w-28 rounded-full"
            style={{
              background: isDark
                ? `linear-gradient(90deg, rgb(41 37 36), ${accent})`
                : `linear-gradient(90deg, ${pale}, ${accent})`,
            }}
          />
          <span className="text-[10px] font-medium text-stone-400">High</span>
        </div>
      </div>
    </div>
  );
}
