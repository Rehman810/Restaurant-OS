import { resolvePresetRange, type ResolvedRange } from "../analytics/range";
import { shiftStoreDateKey, storeDateKey, utcRangeForStoreDateKey } from "../dashboard/dates";

export type BranchesListRange = "today" | "7d" | "30d";

export function parseBranchesListRange(raw: unknown): BranchesListRange {
  if (raw === "7d" || raw === "30d") return raw;
  return "today";
}

export function resolveBranchesRange(range: BranchesListRange, timezone: string, ref = new Date()): ResolvedRange {
  if (range === "today") {
    return resolvePresetRange("today", timezone, ref);
  }
  if (range === "30d") {
    return resolvePresetRange("last_30", timezone, ref);
  }
  const todayKey = storeDateKey(timezone, ref);
  const fromKey = shiftStoreDateKey(todayKey, -6, timezone);
  const startUtc = utcRangeForStoreDateKey(fromKey, timezone).startUtc;
  const endUtc = utcRangeForStoreDateKey(todayKey, timezone).endUtc;
  return { preset: "custom", fromKey, toKey: todayKey, startUtc, endUtc };
}

export function previousPeriodRange(current: ResolvedRange, timezone: string): ResolvedRange {
  const days =
    Math.round((current.endUtc.getTime() - current.startUtc.getTime()) / 86400000) + 1;
  const prevToKey = shiftStoreDateKey(current.fromKey, -1, timezone);
  const prevFromKey = shiftStoreDateKey(prevToKey, -(days - 1), timezone);
  const startUtc = utcRangeForStoreDateKey(prevFromKey, timezone).startUtc;
  const endUtc = utcRangeForStoreDateKey(prevToKey, timezone).endUtc;
  return { preset: "custom", fromKey: prevFromKey, toKey: prevToKey, startUtc, endUtc };
}
