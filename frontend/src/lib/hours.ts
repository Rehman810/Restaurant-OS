export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export type TimeSlot = { open: string; close: string };
export type DaySchedule = { closed: boolean; slots: TimeSlot[] };
export type WeeklySchedule = Record<Weekday, DaySchedule>;

const SHORT: Record<Weekday, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

const FROM_INTL: Record<string, Weekday> = {
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
  Sun: "sun",
};

export function formatTime12(hour24: number, minute: number) {
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const mm = minute.toString().padStart(2, "0");
  return `${hour12}:${mm} ${period}`;
}

export function formatHm(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseMinutes(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

export function legacySchedule(
  openHour: number,
  openMinute: number,
  closeHour: number,
  closeMinute: number
): WeeklySchedule {
  const slot = {
    open: formatHm(openHour * 60 + openMinute),
    close: formatHm(closeHour * 60 + closeMinute),
  };
  return Object.fromEntries(
    WEEKDAYS.map((day) => [day, { closed: false, slots: [{ ...slot }] }])
  ) as WeeklySchedule;
}

export function coerceSchedule(
  raw: unknown,
  legacy: { openHour: number; openMinute: number; closeHour: number; closeMinute: number }
): WeeklySchedule {
  const fallback = legacySchedule(legacy.openHour, legacy.openMinute, legacy.closeHour, legacy.closeMinute);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const src = raw as Record<string, unknown>;
  const out: WeeklySchedule = { ...fallback };
  for (const day of WEEKDAYS) {
    const row = src[day];
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const closed = Boolean((row as { closed?: unknown }).closed);
    const slotsIn = Array.isArray((row as { slots?: unknown }).slots)
      ? ((row as { slots: unknown[] }).slots)
      : [];
    const slots: TimeSlot[] = [];
    for (const slot of slotsIn) {
      if (!slot || typeof slot !== "object") continue;
      const open = String((slot as { open?: unknown }).open ?? "");
      const close = String((slot as { close?: unknown }).close ?? "");
      if (parseMinutes(open) == null || parseMinutes(close) == null) continue;
      slots.push({ open, close });
    }
    out[day] = { closed, slots: closed ? [] : slots.slice(0, 3) };
  }
  return out;
}

export function zonedClock(now: Date, timeZone = "Asia/Karachi") {
  let zone = timeZone || "Asia/Karachi";
  try {
    Intl.DateTimeFormat(undefined, { timeZone: zone });
  } catch {
    zone = "Asia/Karachi";
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday = FROM_INTL[parts.find((p) => p.type === "weekday")?.value || "Mon"] || "mon";
  let hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  if (hour === 24) hour = 0;
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return { weekday, minutes: hour * 60 + minute };
}

function previousDay(day: Weekday): Weekday {
  return WEEKDAYS[(WEEKDAYS.indexOf(day) + 6) % 7];
}

function nextDay(day: Weekday): Weekday {
  return WEEKDAYS[(WEEKDAYS.indexOf(day) + 1) % 7];
}

function slotCovers(slot: TimeSlot, minutes: number, spill: boolean) {
  const open = parseMinutes(slot.open);
  const close = parseMinutes(slot.close);
  if (open == null || close == null) return false;
  if (open === close) return !spill;
  if (open < close) return !spill && minutes >= open && minutes < close;
  if (!spill) return minutes >= open;
  return minutes < close;
}

/** Start is inclusive, end is exclusive. An overnight slot still covers the next morning. */
export function isOpenAt(schedule: WeeklySchedule, weekday: Weekday, minutes: number) {
  const today = schedule[weekday];
  if (!today.closed) {
    for (const slot of today.slots) {
      if (slotCovers(slot, minutes, false)) return true;
    }
  }
  const yesterday = schedule[previousDay(weekday)];
  if (!yesterday.closed) {
    for (const slot of yesterday.slots) {
      if (slotCovers(slot, minutes, true)) return true;
    }
  }
  return false;
}

export function isKitchenOpen(
  input: { forceClosed: boolean; timezone?: string | null; schedule: WeeklySchedule },
  now = new Date()
) {
  if (input.forceClosed) return false;
  const clock = zonedClock(now, input.timezone || "Asia/Karachi");
  return isOpenAt(input.schedule, clock.weekday, clock.minutes);
}

function slotPhrase(slot: TimeSlot) {
  const open = parseMinutes(slot.open)!;
  const close = parseMinutes(slot.close)!;
  const overnight = close <= open;
  const base = `${formatTime12(Math.floor(open / 60), open % 60)} – ${formatTime12(Math.floor(close / 60), close % 60)}`;
  return overnight ? `${base}, next day` : base;
}

function dayPhrase(day: DaySchedule) {
  if (day.closed || day.slots.length === 0) return "Closed";
  return day.slots.map(slotPhrase).join(", ");
}

export function hoursText(schedule: WeeklySchedule) {
  const phrases = WEEKDAYS.map((day) => dayPhrase(schedule[day]));
  if (phrases.every((phrase) => phrase === phrases[0])) {
    return phrases[0] === "Closed" ? "Closed every day" : `Every day, ${phrases[0]}`;
  }
  const parts: string[] = [];
  let index = 0;
  while (index < WEEKDAYS.length) {
    let end = index;
    while (end + 1 < WEEKDAYS.length && phrases[end + 1] === phrases[index]) end += 1;
    const label =
      index === end ? SHORT[WEEKDAYS[index]] : `${SHORT[WEEKDAYS[index]]}–${SHORT[WEEKDAYS[end]]}`;
    parts.push(phrases[index] === "Closed" ? `${label} closed` : `${label} ${phrases[index]}`);
    index = end + 1;
  }
  return parts.join(" · ");
}

export function nextOpening(schedule: WeeklySchedule, timeZone: string, now = new Date()) {
  const start = zonedClock(now, timeZone);
  if (isOpenAt(schedule, start.weekday, start.minutes)) {
    return null;
  }
  let weekday = start.weekday;
  let minutes = start.minutes;
  for (let step = 0; step <= 8 * 24 * 60; step += 1) {
    if (step > 0) minutes += 1;
    if (minutes >= 24 * 60) {
      minutes = 0;
      weekday = nextDay(weekday);
    }
    if (!isOpenAt(schedule, weekday, minutes)) continue;
    const when =
      step < 24 * 60 - start.minutes
        ? "today"
        : step < 48 * 60 - start.minutes
          ? "tomorrow"
          : SHORT[weekday];
    const label = `${when} at ${formatTime12(Math.floor(minutes / 60), minutes % 60)}`;
    return { weekday, minutes, label };
  }
  return null;
}

export function defaultClosedMessage(schedule: WeeklySchedule, timeZone: string, now = new Date()) {
  const next = nextOpening(schedule, timeZone, now);
  const opensAt = next?.label ?? "soon";
  return `Sorry, we are closed right now. We open ${opensAt}.`;
}

export function closedMessageTemplateExample(schedule: WeeklySchedule, timeZone: string, now = new Date()) {
  const opensAt = nextOpening(schedule, timeZone, now)?.label ?? "today at 7:00 PM";
  return `Sorry, we're closed. We open {opensAt}.`.replace("{opensAt}", opensAt);
}
