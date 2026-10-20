import { branchDayRangeUtc } from "../dine-in/branch-time";
import { shiftStoreDateKey, storeDateKey, utcRangeForStoreDateKey } from "../dashboard/dates";

export type AnalyticsPreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "last_30"
  | "this_year"
  | "custom";

export type CompareMode = "previous" | "lastYear" | "none";

export type Granularity = "hour" | "day" | "week";

export const MAX_RANGE_DAYS = 400;

export type ResolvedRange = {
  preset: AnalyticsPreset;
  fromKey: string;
  toKey: string;
  startUtc: Date;
  endUtc: Date;
};

function daysBetweenInclusive(fromKey: string, toKey: string, timezone: string): number {
  const { startUtc: a } = utcRangeForStoreDateKey(fromKey, timezone);
  const { endUtc: b } = utcRangeForStoreDateKey(toKey, timezone);
  return Math.floor((b.getTime() - a.getTime()) / 86400000) + 1;
}

function storeWeekday(timezone: string, ref: Date): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(ref);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? 0;
}

/** Week start: 0=Sunday … 6=Saturday (default Monday = 1). */
export function startOfWeekKey(timezone: string, ref: Date, weekStartDay = 1): string {
  const todayKey = storeDateKey(timezone, ref);
  const { startUtc } = utcRangeForStoreDateKey(todayKey, timezone);
  const dow = storeWeekday(timezone, startUtc);
  const diff = (dow - weekStartDay + 7) % 7;
  return shiftStoreDateKey(todayKey, -diff, timezone);
}

export function startOfMonthKey(timezone: string, ref: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(ref);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${y}-${m}-01`;
}

export function startOfYearKey(timezone: string, ref: Date): string {
  const y = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric" }).format(ref);
  return `${y}-01-01`;
}

export function resolvePresetRange(
  preset: AnalyticsPreset,
  timezone: string,
  ref = new Date(),
  weekStartDay = 1,
  customFrom?: string,
  customTo?: string
): ResolvedRange {
  const todayKey = storeDateKey(timezone, ref);
  let fromKey = todayKey;
  let toKey = todayKey;

  switch (preset) {
    case "today":
      break;
    case "yesterday":
      fromKey = shiftStoreDateKey(todayKey, -1, timezone);
      toKey = fromKey;
      break;
    case "this_week":
      fromKey = startOfWeekKey(timezone, ref, weekStartDay);
      toKey = todayKey;
      break;
    case "last_week":
      fromKey = shiftStoreDateKey(startOfWeekKey(timezone, ref, weekStartDay), -7, timezone);
      toKey = shiftStoreDateKey(fromKey, 6, timezone);
      break;
    case "this_month":
      fromKey = startOfMonthKey(timezone, ref);
      toKey = todayKey;
      break;
    case "last_month": {
      const thisMonthStart = startOfMonthKey(timezone, ref);
      toKey = shiftStoreDateKey(thisMonthStart, -1, timezone);
      fromKey = startOfMonthKey(timezone, new Date(utcRangeForStoreDateKey(toKey, timezone).startUtc));
      break;
    }
    case "last_30":
      fromKey = shiftStoreDateKey(todayKey, -29, timezone);
      toKey = todayKey;
      break;
    case "this_year":
      fromKey = startOfYearKey(timezone, ref);
      toKey = todayKey;
      break;
    case "custom":
      fromKey = customFrom?.trim() || todayKey;
      toKey = customTo?.trim() || fromKey;
      break;
    default:
      break;
  }

  if (fromKey > toKey) {
    const tmp = fromKey;
    fromKey = toKey;
    toKey = tmp;
  }

  const startUtc = utcRangeForStoreDateKey(fromKey, timezone).startUtc;
  const endUtc = utcRangeForStoreDateKey(toKey, timezone).endUtc;

  return { preset, fromKey, toKey, startUtc, endUtc };
}

export function validateRangeDays(fromKey: string, toKey: string, timezone: string) {
  const days = daysBetweenInclusive(fromKey, toKey, timezone);
  if (days > MAX_RANGE_DAYS) {
    throw new RangeError(`Date range cannot exceed ${MAX_RANGE_DAYS} days`);
  }
  if (days < 1) throw new RangeError("Invalid date range");
}

export function resolveComparisonRange(
  primary: ResolvedRange,
  mode: CompareMode,
  timezone: string,
  weekStartDay = 1
): ResolvedRange | null {
  if (mode === "none") return null;
  const days = daysBetweenInclusive(primary.fromKey, primary.toKey, timezone);

  if (mode === "previous") {
    const compareToKey = shiftStoreDateKey(primary.fromKey, -1, timezone);
    const compareFromKey = shiftStoreDateKey(compareToKey, -(days - 1), timezone);
    const startUtc = utcRangeForStoreDateKey(compareFromKey, timezone).startUtc;
    const endUtc = utcRangeForStoreDateKey(compareToKey, timezone).endUtc;
    return {
      preset: "custom",
      fromKey: compareFromKey,
      toKey: compareToKey,
      startUtc,
      endUtc,
    };
  }

  const shiftYear = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return `${y - 1}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };
  const fromKey = shiftYear(primary.fromKey);
  const toKey = shiftYear(primary.toKey);
  return {
    preset: "custom",
    fromKey,
    toKey,
    startUtc: utcRangeForStoreDateKey(fromKey, timezone).startUtc,
    endUtc: utcRangeForStoreDateKey(toKey, timezone).endUtc,
  };
}

export function capGranularity(
  fromKey: string,
  toKey: string,
  timezone: string,
  requested: Granularity
): Granularity {
  const days = daysBetweenInclusive(fromKey, toKey, timezone);
  if (requested === "hour" && days > 14) return "day";
  if (days > 90 && requested !== "week") return "week";
  return requested;
}

export function parsePreset(raw: unknown): AnalyticsPreset {
  const s = String(raw || "this_month").trim();
  const allowed: AnalyticsPreset[] = [
    "today",
    "yesterday",
    "this_week",
    "last_week",
    "this_month",
    "last_month",
    "last_30",
    "this_year",
    "custom",
  ];
  if (allowed.includes(s as AnalyticsPreset)) return s as AnalyticsPreset;
  if (s === "week") return "this_week";
  if (s === "month") return "this_month";
  if (s === "year") return "this_year";
  return "this_month";
}

export function parseCompareMode(raw: unknown): CompareMode {
  if (raw === "lastYear" || raw === "last_year") return "lastYear";
  if (raw === "none") return "none";
  return "previous";
}

export function parseGranularity(raw: unknown): Granularity {
  if (raw === "hour" || raw === "week") return raw;
  return "day";
}

/** Legacy period mapping for GET /admin/analytics?period= */
export function legacyPeriodToPreset(period: "today" | "week" | "month" | "year"): AnalyticsPreset {
  if (period === "week") return "this_week";
  if (period === "month") return "this_month";
  if (period === "year") return "this_year";
  return "today";
}
