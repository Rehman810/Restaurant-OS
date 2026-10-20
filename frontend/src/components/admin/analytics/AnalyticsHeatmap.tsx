"use client";

import { Fragment } from "react";
import { compactRs, formatHeatmapHour, formatHeatmapHourAxis } from "@/lib/analytics/helpers";
import { useAdminTheme } from "@/hooks/useAdminTheme";

type Props = {
  orders: number[][];
  weekdayLabels: string[];
  showRevenue?: boolean;
  revenue?: number[][] | null;
};

function heatColor(t: number, isDark: boolean) {
  if (t <= 0) return isDark ? "rgb(41 37 36)" : "rgb(245 245 244)";
  const stops: [number, string][] = isDark
    ? [
        [0, "rgba(234, 88, 12, 0.08)"],
        [0.25, "rgba(234, 88, 12, 0.22)"],
        [0.5, "rgba(249, 115, 22, 0.45)"],
        [0.75, "rgba(251, 146, 60, 0.72)"],
        [1, "rgba(253, 186, 116, 0.95)"],
      ]
    : [
        [0, "rgba(255, 237, 213, 0.9)"],
        [0.25, "rgba(254, 215, 170, 1)"],
        [0.5, "rgba(251, 146, 60, 0.85)"],
        [0.75, "rgba(234, 88, 12, 0.9)"],
        [1, "rgba(194, 65, 12, 1)"],
      ];
  for (let i = stops.length - 1; i >= 0; i--) {
    if (t >= stops[i][0]) return stops[i][1];
  }
  return stops[0][1];
}

export function AnalyticsHeatmap({ orders, weekdayLabels, showRevenue, revenue }: Props) {
  const grid = showRevenue && revenue ? revenue : orders;
  const max = Math.max(0, ...grid.flat());
  const hours = grid[0]?.length ?? 24;
  const { theme } = useAdminTheme();
  const isDark = theme === "dark";

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
                      style={{ background: heatColor(t, isDark) }}
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
                ? "linear-gradient(90deg, rgb(41 37 36), rgba(253, 186, 116, 0.95))"
                : "linear-gradient(90deg, rgb(245 245 244), rgb(194 65 12))",
            }}
          />
          <span className="text-[10px] font-medium text-stone-400">High</span>
        </div>
      </div>
    </div>
  );
}
