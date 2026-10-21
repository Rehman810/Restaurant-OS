import type { KpiComparison } from "@/lib/dashboard/types";

export type CompareMode = "yesterday" | "lastWeek" | "none";

export function formatStoreDateHeading(dateKey: string, timezone: string) {
  const d = new Date(`${dateKey}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function shiftDateKey(dateKey: string, deltaDays: number) {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

export function todayDateKeyInTz(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${day}`;
}

export function compareParam(mode: CompareMode) {
  if (mode === "lastWeek") return "lastWeek";
  if (mode === "none") return "none";
  return "yesterday";
}

export function pickDelta(kpi: KpiComparison, mode: CompareMode) {
  if (mode === "none") return { pct: null as number | null, label: null as "new" | "flat" | null };
  if (mode === "lastWeek") {
    return { pct: kpi.deltaSameWeekdayPercent, label: kpi.deltaSameWeekdayLabel };
  }
  return { pct: kpi.deltaYesterdayPercent, label: kpi.deltaYesterdayLabel };
}

export function paymentSplitProof(split: {
  cash: number;
  card: number;
  codReceived: number;
  unspecified: number;
}) {
  const sum = split.cash + split.card + split.codReceived + split.unspecified;
  return { sum, parts: split };
}

export function dayStatusLabel(status: "provisional" | "final", reasons: string[]) {
  if (status === "final") return "Final";
  if (!reasons.length) return "Provisional";
  return `Provisional: ${reasons[0]}`;
}

export function pluralize(n: number, word: string) {
  return n === 1 ? word : `${word}s`;
}
