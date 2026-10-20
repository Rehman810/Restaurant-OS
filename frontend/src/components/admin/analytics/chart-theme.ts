import { useId } from "react";
import { useAdminTheme } from "@/hooks/useAdminTheme";
import { pkr } from "@/lib/format";

export const CHART_COLORS = [
  "#f97316",
  "#ea580c",
  "#fb923c",
  "#14b8a6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#0ea5e9",
  "#84cc16",
  "#a8a29e",
];

export function useChartTheme() {
  const { theme } = useAdminTheme();
  const isDark = theme === "dark";
  return {
    isDark,
    grid: isDark ? "rgba(68,64,60,0.45)" : "rgba(231,229,228,0.9)",
    tick: isDark ? "#a8a29e" : "#78716c",
    axis: isDark ? "#57534e" : "#d6d3d1",
  };
}

export function useChartGradId(prefix: string) {
  const id = useId().replace(/:/g, "");
  return `${prefix}-${id}`;
}

export type ValueFormat = "number" | "money" | "percent";

export function formatChartValue(v: number, format: ValueFormat) {
  if (format === "money") return pkr(v);
  if (format === "percent") return `${v}%`;
  return String(v);
}
