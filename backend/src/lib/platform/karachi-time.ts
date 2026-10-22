import { branchDayKey, branchDayRangeUtc } from "../dine-in/branch-time";

export const PLATFORM_TIMEZONE = "Asia/Karachi";

export function karachiDayRangeUtc(ref: Date = new Date()) {
  return branchDayRangeUtc(PLATFORM_TIMEZONE, ref);
}

export function karachiDayKey(ref: Date = new Date()) {
  return branchDayKey(PLATFORM_TIMEZONE, ref);
}

/** YYYY-MM-DD in Karachi for DB @db.Date rows. */
export function karachiDateOnly(ref: Date = new Date()) {
  const key = karachiDayKey(ref);
  return new Date(`${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}T00:00:00.000Z`);
}

export function addKarachiDays(ref: Date, days: number) {
  const next = new Date(ref);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
