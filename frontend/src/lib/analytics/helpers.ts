import { formatTime12 } from "@/lib/store-hours";

/** 12-hour clock for heatmap cells and insights (e.g. 2:00 PM). */
export function formatHeatmapHour(hour24: number) {
  return formatTime12(hour24, 0);
}

/** Shorter axis labels (e.g. 2 PM). */
export function formatHeatmapHourAxis(hour24: number) {
  const period = hour24 >= 12 ? "PM" : "AM";
  const h = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${h} ${period}`;
}

export function formatDeltaDisplay(
  deltaPercent: number | null,
  deltaLabel: "new" | "flat" | null,
  invertGood = false
): { text: string; direction: "up" | "down" | "neutral" } {
  if (deltaLabel === "flat" || (deltaPercent == null && deltaLabel === "new")) {
    return { text: "—", direction: "neutral" };
  }
  if (deltaPercent == null) return { text: "—", direction: "neutral" };
  const sign = deltaPercent > 0 ? "+" : "";
  const text = `${sign}${deltaPercent}%`;
  let direction: "up" | "down" | "neutral" = deltaPercent > 0 ? "up" : deltaPercent < 0 ? "down" : "neutral";
  if (invertGood && direction !== "neutral") {
    direction = direction === "up" ? "down" : "up";
  }
  return { text, direction };
}

export function pluralizeCustomers(n: number) {
  return n === 1 ? "1 customer" : `${n} customers`;
}

export function compactRs(amount: number, symbol = "Rs") {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${symbol} ${(amount / 1_000_000).toFixed(1)}m`;
  if (abs >= 10_000) return `${symbol} ${(amount / 1_000).toFixed(1)}k`;
  if (abs >= 1_000) return `${symbol} ${(amount / 1_000).toFixed(2)}k`;
  return `${symbol} ${Math.round(amount)}`;
}

export function formatRangeSubtitle(fromKey: string, toKey: string, timezone: string) {
  const fmt = (key: string) => {
    const d = new Date(`${key}T12:00:00Z`);
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(d);
  };
  const tzLabel = timezone.replace("_", " ");
  if (fromKey === toKey) return `${fmt(fromKey)} (${tzLabel} time)`;
  return `${fmt(fromKey)} to ${fmt(toKey)} (${tzLabel} time)`;
}

export function activeChartSlices<T extends { value: number }>(slices: T[]) {
  return slices.filter((s) => s.value > 0);
}

export function chartSliceTotal(slices: { value: number }[]) {
  return slices.reduce((sum, s) => sum + s.value, 0);
}

export function hasHeatmapActivity(orders: number[][]) {
  return orders.some((row) => row.some((v) => v > 0));
}

export function heatmapTopSlots(
  grid: number[][],
  weekdayLabels: string[],
  limit = 3
): { label: string; orders: number }[] {
  const slots: { label: string; orders: number }[] = [];
  for (let d = 0; d < grid.length; d++) {
    for (let h = 0; h < grid[d].length; h++) {
      slots.push({ label: `${weekdayLabels[d]} ${formatHeatmapHour(h)}`, orders: grid[d][h] });
    }
  }
  return slots.sort((a, b) => b.orders - a.orders).slice(0, limit);
}

export function niceTicks(max: number, target = 5) {
  if (max <= 0) return [0, 1];
  const rough = max / target;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const step = norm <= 1 ? mag : norm <= 2 ? 2 * mag : norm <= 5 ? 5 * mag : 10 * mag;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return [...new Set(ticks)];
}
