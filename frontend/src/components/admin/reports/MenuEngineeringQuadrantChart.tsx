"use client";

import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { pkr } from "@/lib/format";
import { useChartTheme } from "@/components/admin/analytics/chart-theme";
import { useAdminTheme } from "@/hooks/useAdminTheme";

export type QuadrantPoint = {
  id: string;
  name: string;
  sharePercent: number;
  marginPerUnit: number;
  classification: string | null;
};

const CLASS_COLOR: Record<string, string> = {
  STAR: "#10b981",
  PLOWHORSE: "#f59e0b",
  PUZZLE: "#3b82f6",
  DOG: "#ef4444",
};

function pointColor(classification: string | null) {
  if (!classification) return "#a8a29e";
  return CLASS_COLOR[classification] ?? "#a8a29e";
}

function QuadrantTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: QuadrantPoint }[];
}) {
  if (!active || !payload?.[0]) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-stone-600 dark:bg-stone-900">
      <p className="font-semibold text-stone-900 dark:text-stone-50">{p.name}</p>
      <p className="text-stone-600 dark:text-stone-300">Share: {p.sharePercent}%</p>
      <p className="text-stone-600 dark:text-stone-300">Margin: {pkr(p.marginPerUnit)} / unit</p>
    </div>
  );
}

export function MenuEngineeringQuadrantChart({
  points,
  popularitySharePercent,
  marginThreshold,
  hasEnoughData,
}: {
  points: QuadrantPoint[];
  popularitySharePercent: number;
  marginThreshold: number;
  hasEnoughData: boolean;
}) {
  const theme = useChartTheme();
  const { theme: adminTheme } = useAdminTheme();
  const isDark = adminTheme === "dark";

  if (!points.length) {
    return (
      <p className="text-sm text-stone-500 dark:text-stone-400">No dishes to plot for this filter.</p>
    );
  }

  const maxShare = Math.max(popularitySharePercent * 1.5, ...points.map((p) => p.sharePercent), 5);

  return (
    <div className="h-72 w-full min-w-0 sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="sharePercent"
            name="Share"
            unit="%"
            domain={[0, Math.ceil(maxShare)]}
            tick={{ fill: theme.tick, fontSize: 11 }}
            axisLine={{ stroke: theme.axis }}
            label={{
              value: "Share of sales %",
              position: "insideBottom",
              offset: -2,
              fill: theme.tick,
              fontSize: 11,
            }}
          />
          <YAxis
            type="number"
            dataKey="marginPerUnit"
            name="Margin"
            tick={{ fill: theme.tick, fontSize: 11 }}
            axisLine={{ stroke: theme.axis }}
            tickFormatter={(v) => pkr(v)}
            label={{
              value: "Margin (Rs / unit)",
              angle: -90,
              position: "insideLeft",
              fill: theme.tick,
              fontSize: 11,
            }}
          />
          <ZAxis range={[48, 48]} />
          {hasEnoughData && (
            <>
              <ReferenceLine
                x={popularitySharePercent}
                stroke={isDark ? "#78716c" : "#a8a29e"}
                strokeDasharray="4 4"
              />
              <ReferenceLine
                y={marginThreshold}
                stroke={isDark ? "#78716c" : "#a8a29e"}
                strokeDasharray="4 4"
              />
            </>
          )}
          <Tooltip content={<QuadrantTooltip />} cursor={{ strokeDasharray: "3 3" }} />
          <Scatter
            data={points}
            shape={(props) => {
              const { cx, cy, payload } = props as {
                cx: number;
                cy: number;
                payload: QuadrantPoint;
              };
              const fill = pointColor(payload.classification);
              return <circle cx={cx} cy={cy} r={6} fill={fill} fillOpacity={0.9} />;
            }}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
