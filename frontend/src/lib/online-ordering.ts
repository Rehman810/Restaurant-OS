import {
  coerceSchedule,
  isKitchenOpen,
  isOpenAt,
  nextOpening,
  parseMinutes,
  zonedClock,
  type WeeklySchedule,
} from "./hours";
import { effectiveWeeklySchedule, parseSpecialHours } from "./special-hours";

export type OnlineOrderingSettings = {
  forceClosed: boolean;
  timezone?: string | null;
  weeklySchedule?: unknown;
  openHour: number;
  openMinute: number;
  closeHour: number;
  closeMinute: number;
  specialHours?: unknown;
  onlineReopenAt?: string | Date | null;
  lastOrderCutoffMinutes?: number;
  closedMessage?: string;
  onlineCloseReason?: string;
};

function scheduleFor(settings: OnlineOrderingSettings): WeeklySchedule {
  return coerceSchedule(settings.weeklySchedule, settings);
}

export function resolveForceClosed(settings: OnlineOrderingSettings, now = new Date()): boolean {
  if (!settings.forceClosed) return false;
  const reopen = settings.onlineReopenAt;
  if (reopen) {
    const at = reopen instanceof Date ? reopen : new Date(reopen);
    if (!Number.isNaN(at.getTime()) && now >= at) return false;
  }
  return true;
}

export function effectiveSchedule(settings: OnlineOrderingSettings, now = new Date()): WeeklySchedule {
  const weekly = scheduleFor(settings);
  const special = parseSpecialHours(settings.specialHours);
  const tz = settings.timezone || "Asia/Karachi";
  return effectiveWeeklySchedule(weekly, special, now, tz);
}

export function isScheduleOpen(settings: OnlineOrderingSettings, now = new Date()) {
  const tz = settings.timezone || "Asia/Karachi";
  const schedule = effectiveSchedule(settings, now);
  return isKitchenOpen({ forceClosed: false, timezone: tz, schedule }, now);
}

function minutesUntilCurrentSlotEnds(schedule: WeeklySchedule, timeZone: string, now: Date): number | null {
  const clock = zonedClock(now, timeZone);
  if (!isOpenAt(schedule, clock.weekday, clock.minutes)) return null;
  let best: number | null = null;
  const consider = (daySchedule: { closed: boolean; slots: { open: string; close: string }[] }, spill: boolean) => {
    if (daySchedule.closed) return;
    for (const slot of daySchedule.slots) {
      const open = parseMinutes(slot.open);
      const close = parseMinutes(slot.close);
      if (open == null || close == null) continue;
      let end = close;
      if (open < close) {
        if (!spill && clock.minutes >= open && clock.minutes < close) end = close;
        else continue;
      } else if (!spill) {
        if (clock.minutes >= open) end = close + 24 * 60;
        else continue;
      } else if (clock.minutes < close) {
        end = close;
      } else continue;
      const remaining = end - clock.minutes;
      if (remaining > 0 && (best == null || remaining < best)) best = remaining;
    }
  };
  consider(schedule[clock.weekday], false);
  const prev = (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const)[
    (["mon", "tue", "wed", "thu", "fri", "sat", "sun"].indexOf(clock.weekday) + 6) % 7
  ];
  consider(schedule[prev], true);
  return best;
}

export function isOnlineOrderingOpen(settings: OnlineOrderingSettings, now = new Date()) {
  if (resolveForceClosed(settings, now)) return false;
  const tz = settings.timezone || "Asia/Karachi";
  const schedule = effectiveSchedule(settings, now);
  if (!isKitchenOpen({ forceClosed: false, timezone: tz, schedule }, now)) return false;
  const cutoff = Math.max(0, settings.lastOrderCutoffMinutes ?? 0);
  if (cutoff > 0) {
    const remaining = minutesUntilCurrentSlotEnds(schedule, tz, now);
    if (remaining != null && remaining <= cutoff) return false;
  }
  return true;
}

export function onlineOrderingClosedMessage(settings: OnlineOrderingSettings, now = new Date()) {
  const custom = (settings.closedMessage ?? "").trim();
  const tz = settings.timezone || "Asia/Karachi";
  const schedule = effectiveSchedule(settings, now);
  const opensAt = nextOpening(schedule, tz, now)?.label ?? "soon";
  if (custom) {
    if (custom.includes("{opensAt}")) return custom.replaceAll("{opensAt}", opensAt);
    return custom;
  }
  if (resolveForceClosed(settings, now) && (settings.onlineCloseReason ?? "").trim()) {
    return settings.onlineCloseReason!.trim();
  }
  if (!nextOpening(schedule, tz, now)) return "Sorry, we are closed right now.";
  return `Sorry, we are closed right now. We open ${opensAt}.`;
}
