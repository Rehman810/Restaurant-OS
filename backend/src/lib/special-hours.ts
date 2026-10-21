import { coerceSchedule, parseMinutes, type DaySchedule, type TimeSlot, type Weekday, type WeeklySchedule, WEEKDAYS, zonedClock } from "./hours";

export type SpecialHoursEntry = {
  id: string;
  label: string;
  startDate: string;
  endDate?: string;
  closed?: boolean;
  slots?: TimeSlot[];
};

export function parseSpecialHours(raw: unknown): SpecialHoursEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: SpecialHoursEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const id = String((row as { id?: unknown }).id ?? "").trim();
    const label = String((row as { label?: unknown }).label ?? "").trim();
    const startDate = String((row as { startDate?: unknown }).startDate ?? "").trim();
    if (!id || !startDate) continue;
    const endDate = String((row as { endDate?: unknown }).endDate ?? "").trim() || undefined;
    const closed = Boolean((row as { closed?: unknown }).closed);
    const slotsIn = Array.isArray((row as { slots?: unknown }).slots) ? (row as { slots: unknown[] }).slots : [];
    const slots: TimeSlot[] = [];
    for (const slot of slotsIn) {
      if (!slot || typeof slot !== "object") continue;
      const open = String((slot as { open?: unknown }).open ?? "");
      const close = String((slot as { close?: unknown }).close ?? "");
      if (parseMinutes(open) == null || parseMinutes(close) == null) continue;
      slots.push({ open, close });
    }
    out.push({ id, label, startDate, endDate, closed, slots: closed ? [] : slots });
  }
  return out.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

function ymdInTimezone(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

function dateInRange(ymd: string, start: string, end?: string) {
  if (ymd < start) return false;
  if (!end || end === start) return ymd === start;
  return ymd >= start && ymd <= end;
}

export function specialEntryForDate(entries: SpecialHoursEntry[], ymd: string): SpecialHoursEntry | null {
  const matches = entries.filter((e) => dateInRange(ymd, e.startDate, e.endDate));
  if (!matches.length) return null;
  return matches[matches.length - 1];
}

/** Weekly schedule with special-day overrides applied for the given instant. */
export function effectiveWeeklySchedule(
  weekly: WeeklySchedule,
  special: SpecialHoursEntry[],
  now: Date,
  timeZone: string
): WeeklySchedule {
  const ymd = ymdInTimezone(now, timeZone);
  const entry = specialEntryForDate(special, ymd);
  if (!entry) return weekly;
  const clock = zonedClock(now, timeZone);
  const day = clock.weekday;
  if (entry.closed) {
    return { ...weekly, [day]: { closed: true, slots: [] } };
  }
  if (entry.slots && entry.slots.length > 0) {
    return { ...weekly, [day]: { closed: false, slots: entry.slots.slice(0, 3) } };
  }
  return weekly;
}

export function upcomingSpecialHours(entries: SpecialHoursEntry[], fromYmd: string, limit = 20) {
  return entries.filter((e) => (e.endDate ?? e.startDate) >= fromYmd).slice(0, limit);
}

export function defaultSpecialId() {
  return `sp-${Date.now().toString(36)}`;
}
