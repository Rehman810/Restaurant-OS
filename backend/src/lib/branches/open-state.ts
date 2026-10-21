import { getStoreSettings } from "../settings-data";
import { isStoreOpen, scheduleFor } from "../store-settings";
import { nextOpening, parseMinutes, isOpenAt, zonedClock, formatTime12, type WeeklySchedule } from "../hours";

export type BranchOpenState = {
  isOpenNow: boolean;
  hoursSource: "store";
  nextOpenAt: string | null;
  nextCloseAt: string | null;
  nextOpenLabel: string | null;
  nextCloseLabel: string | null;
};

/** Opening hours are store-wide today; branch timezone is used for the clock only. */
export async function resolveBranchOpenState(branchTimezone: string, now = new Date()): Promise<BranchOpenState> {
  const settings = await getStoreSettings();
  const schedule = scheduleFor(settings);
  const tz = branchTimezone || settings.timezone || "Asia/Karachi";
  const open = isStoreOpen(settings, now);

  let nextOpenLabel: string | null = null;
  let nextOpenAt: string | null = null;
  let nextCloseLabel: string | null = null;
  let nextCloseAt: string | null = null;

  if (!open) {
    const next = nextOpening(schedule, tz, now);
    nextOpenLabel = next?.label ?? null;
    nextOpenAt = null;
  } else {
    const close = currentSlotCloseLabel(schedule, tz, now);
    nextCloseLabel = close?.label ?? null;
    nextCloseAt = close?.atIso ?? null;
  }

  return {
    isOpenNow: open,
    hoursSource: "store",
    nextOpenAt,
    nextCloseAt,
    nextOpenLabel,
    nextCloseLabel,
  };
}

function currentSlotCloseLabel(schedule: WeeklySchedule, timeZone: string, now: Date) {
  const clock = zonedClock(now, timeZone);
  const day = schedule[clock.weekday];
  if (day.closed || !day.slots.length) return null;
  for (const slot of day.slots) {
    const open = parseMinutes(slot.open);
    const close = parseMinutes(slot.close);
    if (open === null || close === null) continue;
    if (!isOpenAt(schedule, clock.weekday, clock.minutes)) continue;
    if (clock.minutes >= open && clock.minutes < close) {
      const label = `Closes at ${formatTime12(Math.floor(close / 60), close % 60)}`;
      return { label, atIso: null };
    }
  }
  return null;
}
