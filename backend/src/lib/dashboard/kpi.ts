/** KPI comparison helpers — avoid Infinity/NaN when previous is zero. */
export type KpiComparison = {
  value: number;
  previousYesterday: number;
  previousSameWeekday: number;
  deltaYesterdayPercent: number | null;
  deltaSameWeekdayPercent: number | null;
  deltaYesterdayLabel: "new" | "flat" | null;
  deltaSameWeekdayLabel: "new" | "flat" | null;
};

export function compareKpi(value: number, previousYesterday: number, previousSameWeekday: number): KpiComparison {
  const dy = deltaPercent(value, previousYesterday);
  const dw = deltaPercent(value, previousSameWeekday);
  return {
    value,
    previousYesterday,
    previousSameWeekday,
    deltaYesterdayPercent: dy.pct,
    deltaSameWeekdayPercent: dw.pct,
    deltaYesterdayLabel: dy.label,
    deltaSameWeekdayLabel: dw.label,
  };
}

export function deltaPercent(current: number, previous: number): { pct: number | null; label: "new" | "flat" | null } {
  if (previous === 0) {
    if (current === 0) return { pct: null, label: "flat" };
    return { pct: null, label: "new" };
  }
  const pct = Math.round(((current - previous) / previous) * 1000) / 10;
  if (!Number.isFinite(pct)) return { pct: null, label: null };
  return { pct, label: null };
}

export function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}
