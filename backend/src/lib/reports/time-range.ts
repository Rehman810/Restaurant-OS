import { branchDayRangeUtc } from "../dine-in/branch-time";

/** Parse YYYY-MM-DD in branch context; default end = start if only one day. */
export function parseDateRangeQuery(
  fromRaw: unknown,
  toRaw: unknown,
  timezone: string,
  fallbackDays = 7
) {
  const now = new Date();
  const { startUtc: todayStart, endUtc: todayEnd } = branchDayRangeUtc(timezone, now);

  const fromProvided = Boolean(fromRaw && String(fromRaw).trim());
  const toProvided = Boolean(toRaw && String(toRaw).trim());

  let from = fromRaw ? String(fromRaw).trim() : "";
  let to = toRaw ? String(toRaw).trim() : "";

  if (!from) {
    const start = new Date(todayStart);
    start.setUTCDate(start.getUTCDate() - (fallbackDays - 1));
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(start);
    const y = parts.find((p) => p.type === "year")?.value ?? "1970";
    const m = parts.find((p) => p.type === "month")?.value ?? "01";
    const d = parts.find((p) => p.type === "day")?.value ?? "01";
    from = `${y}-${m}-${d}`;
  }
  if (!to) {
    if (!fromProvided && !toProvided) {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(now);
      const y = parts.find((p) => p.type === "year")?.value ?? "1970";
      const m = parts.find((p) => p.type === "month")?.value ?? "01";
      const d = parts.find((p) => p.type === "day")?.value ?? "01";
      to = `${y}-${m}-${d}`;
    } else {
      to = from;
    }
  }

  const startUtc = branchDayRangeUtc(timezone, new Date(`${from}T12:00:00Z`)).startUtc;
  const endUtc = branchDayRangeUtc(timezone, new Date(`${to}T12:00:00Z`)).endUtc;

  return { from, to, startUtc, endUtc };
}

export function storeTodayUtcRange(timezone: string) {
  const { startUtc, endUtc } = branchDayRangeUtc(timezone);
  return { start: startUtc, end: endUtc };
}
