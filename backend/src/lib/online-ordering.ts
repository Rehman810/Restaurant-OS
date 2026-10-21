import type { StoreSettings } from "@prisma/client";
import { isKitchenOpen, nextOpening, parseMinutes, zonedClock, type WeeklySchedule, isOpenAt } from "./hours";
import { effectiveWeeklySchedule, parseSpecialHours } from "./special-hours";
import { scheduleFor } from "./store-settings";

export function resolveForceClosed(settings: StoreSettings, now = new Date()): boolean {
  if (!settings.forceClosed) return false;
  if (settings.onlineReopenAt && now >= settings.onlineReopenAt) return false;
  return true;
}

export function effectiveSchedule(settings: StoreSettings, now = new Date()): WeeklySchedule {
  const weekly = scheduleFor(settings);
  const special = parseSpecialHours(settings.specialHours);
  const tz = settings.timezone || "Asia/Karachi";
  return effectiveWeeklySchedule(weekly, special, now, tz);
}

/** Store schedule open (ignores manual online close). Used for dine-in / kitchen hours. */
export function isScheduleOpen(settings: StoreSettings, now = new Date()) {
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

/** Customer online ordering (web/app). Respects force close, special hours, schedule, and last-order cutoff. */
export function isOnlineOrderingOpen(settings: StoreSettings, now = new Date()) {
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

export function onlineOrderingClosedMessage(settings: StoreSettings, now = new Date()) {
  const custom = settings.closedMessage.trim();
  const tz = settings.timezone || "Asia/Karachi";
  const schedule = effectiveSchedule(settings, now);
  const opensAt = nextOpening(schedule, tz, now)?.label ?? "soon";
  if (custom) {
    if (custom.includes("{opensAt}")) return custom.split("{opensAt}").join(opensAt);
    return custom;
  }
  if (resolveForceClosed(settings, now) && settings.onlineCloseReason.trim()) {
    return settings.onlineCloseReason.trim();
  }
  if (!nextOpening(schedule, tz, now)) return "Sorry, we are closed right now.";
  return `Sorry, we are closed right now. We open ${opensAt}.`;
}
