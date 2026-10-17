import { branchDayRangeUtc } from "../dine-in/branch-time";

/** Shift a store-local calendar date (YYYY-MM-DD) by `deltaDays`. */
export function shiftStoreDateKey(dateKey: string, deltaDays: number, timezone: string): string {
  const { startUtc } = branchDayRangeUtc(timezone, new Date(`${dateKey}T12:00:00Z`));
  const d = new Date(startUtc);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${day}`;
}

export function storeDateKey(timezone: string, ref = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ref);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

export function storeHourInTz(timezone: string, ref = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(ref);
  return Number(parts.find((p) => p.type === "hour")?.value ?? 0);
}

export function formatChartDayLabel(dateKey: string, timezone: string) {
  const { startUtc } = branchDayRangeUtc(timezone, new Date(`${dateKey}T12:00:00Z`));
  const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, weekday: "short" }).format(startUtc);
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, day: "numeric" }).format(startUtc);
  return `${weekday} ${day}`;
}

/** Last N calendar days in store TZ, oldest first, zero-filled keys. */
export function lastNStoreDateKeys(timezone: string, n: number, ref = new Date()) {
  const today = storeDateKey(timezone, ref);
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    keys.push(shiftStoreDateKey(today, -i, timezone));
  }
  return keys;
}

export function utcRangeForStoreDateKey(dateKey: string, timezone: string) {
  return branchDayRangeUtc(timezone, new Date(`${dateKey}T12:00:00Z`));
}
