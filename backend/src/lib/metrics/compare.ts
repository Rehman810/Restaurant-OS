import { deltaPercent, roundMoney } from "../dashboard/kpi";

export type MetricWithComparison = {
  value: number;
  previous: number;
  deltaPercent: number | null;
  deltaLabel: "new" | "flat" | null;
};

export function withComparison(value: number, previous: number): MetricWithComparison {
  const v = roundMoney(value);
  const p = roundMoney(previous);
  const d = deltaPercent(v, p);
  return {
    value: v,
    previous: p,
    deltaPercent: d.pct,
    deltaLabel: d.label,
  };
}

export function withComparisonInt(value: number, previous: number): MetricWithComparison {
  const d = deltaPercent(value, previous);
  return {
    value,
    previous,
    deltaPercent: d.pct,
    deltaLabel: d.label,
  };
}
