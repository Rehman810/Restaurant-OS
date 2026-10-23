import { useId, useMemo } from "react";
import { useAdminTheme } from "@/hooks/useAdminTheme";
import { pkr } from "@/lib/format";
import { useStore } from "@/lib/store";

/** Read tenant brand tokens set by `applyBrandTheme` on :root */
export function readBrandCssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function resolveColorToRgb(color: string): [number, number, number] {
  if (typeof window === "undefined") return [234, 88, 12];
  const el = document.createElement("span");
  el.style.color = color;
  el.style.display = "none";
  document.body.appendChild(el);
  const computed = getComputedStyle(el).color;
  el.remove();
  const parts = computed.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return [234, 88, 12];
  return [Math.round(Number(parts[0])), Math.round(Number(parts[1])), Math.round(Number(parts[2]))];
}

function mixCssColors(a: string, b: string, aPercent: number): string {
  if (typeof window === "undefined") return a;
  const el = document.createElement("span");
  el.style.color = `color-mix(in srgb, ${a} ${aPercent}%, ${b})`;
  el.style.display = "none";
  document.body.appendChild(el);
  const out = getComputedStyle(el).color;
  el.remove();
  return out;
}

/** Default series when CSS vars are unavailable (SSR). */
export const CHART_COLORS_FALLBACK = [
  "#ea580c",
  "#fb923c",
  "#c2410c",
  "#fdba74",
  "#f97316",
  "#14b8a6",
  "#6366f1",
  "#8b5cf6",
  "#0ea5e9",
  "#a8a29e",
];

/** @deprecated use `useChartSeriesColors()` */
export const CHART_COLORS = CHART_COLORS_FALLBACK;

export function useBrandChartPalette() {
  const { theme } = useAdminTheme();
  const store = useStore();
  const isDark = theme === "dark";
  void store?.settings.primaryColor;
  void store?.settings.accentColor;

  const primary = readBrandCssVar("--brand-600", "#ea580c");
  const accent = readBrandCssVar("--brand-700", "#c2410c");
  const light = readBrandCssVar("--brand-400", "#fb923c");
  const lighter = readBrandCssVar("--brand-300", "#fdba74");
  const mid = readBrandCssVar("--brand-500", "#f97316");
  const pale = readBrandCssVar("--brand-100", "#ffedd5");

  const rgb = useMemo(() => resolveColorToRgb(primary), [primary]);
  const accentRgb = useMemo(() => resolveColorToRgb(accent), [accent]);
  const paleRgb = useMemo(() => resolveColorToRgb(pale), [pale]);

  const series = useMemo(() => {
    const blendTeal = mixCssColors(primary, "#14b8a6", 62);
    const blendViolet = mixCssColors(accent, "#6366f1", 58);
    return [primary, light, accent, lighter, mid, blendTeal, blendViolet, "#a8a29e"];
  }, [primary, light, accent, lighter, mid]);

  return { isDark, primary, accent, light, lighter, mid, pale, series, rgb, accentRgb, paleRgb };
}

export function useChartSeriesColors(): string[] {
  return useBrandChartPalette().series;
}

export function useChartTheme() {
  const { isDark } = useBrandChartPalette();
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

export function brandHeatColor(
  t: number,
  isDark: boolean,
  rgb: [number, number, number],
  accentRgb: [number, number, number],
  paleRgb: [number, number, number]
) {
  if (t <= 0) return isDark ? "rgb(41 37 36)" : "rgb(245 245 244)";
  const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
  if (isDark) {
    const alpha = 0.1 + t * 0.82;
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
  }
  const r = Math.round(lerp(paleRgb[0], accentRgb[0], t));
  const g = Math.round(lerp(paleRgb[1], accentRgb[1], t));
  const b = Math.round(lerp(paleRgb[2], accentRgb[2], t));
  return `rgb(${r}, ${g}, ${b})`;
}
