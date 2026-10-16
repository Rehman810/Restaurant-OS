/** Branch-local calendar day boundaries returned as UTC Date objects for DB queries. */
export function branchDayRangeUtc(timezone: string, ref: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ref);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  const startLocal = `${y}-${m}-${d}T00:00:00`;
  const endLocal = `${y}-${m}-${d}T23:59:59.999`;
  return {
    startUtc: localInTimezoneToUtc(startLocal, timezone),
    endUtc: localInTimezoneToUtc(endLocal, timezone),
  };
}

export function branchListRangeUtc(timezone: string, ref: Date = new Date(), daysBack = 1, daysForward = 90) {
  const { startUtc: todayStart } = branchDayRangeUtc(timezone, ref);
  const from = new Date(todayStart);
  from.setUTCDate(from.getUTCDate() - daysBack);
  const to = new Date(todayStart);
  to.setUTCDate(to.getUTCDate() + daysForward);
  to.setUTCHours(23, 59, 59, 999);
  return { from, to };
}

function localInTimezoneToUtc(localIso: string, timezone: string): Date {
  const probe = new Date(localIso + "Z");
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const target = new Date(localIso.replace("T", " "));
  let guess = new Date(Date.UTC(target.getFullYear(), target.getMonth(), target.getDate(), target.getHours(), target.getMinutes(), target.getSeconds()));
  for (let i = 0; i < 3; i++) {
    const parts = formatter.formatToParts(guess);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    const y = get("year");
    const mo = get("month");
    const da = get("day");
    const h = get("hour") % 24;
    const mi = get("minute");
    const se = get("second");
    const shown = Date.UTC(y, mo - 1, da, h, mi, se);
    const want = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate(), target.getHours(), target.getMinutes(), target.getSeconds());
    const delta = want - shown;
    guess = new Date(guess.getTime() + delta);
  }
  return guess;
}

/** Compact YYYYMMDD in branch timezone (for POS order sequences). */
export function branchDayKey(timezone: string, ref: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ref);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}${m}${d}`;
}

export function formatInBranchTz(iso: Date | string, timezone: string) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}
