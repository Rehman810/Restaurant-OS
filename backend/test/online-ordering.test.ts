import { describe, expect, it } from "vitest";
import { legacySchedule, nextOpening, type WeeklySchedule } from "../src/lib/hours";
import {
  isOnlineOrderingOpen,
  isScheduleOpen,
  onlineOrderingClosedMessage,
  resolveForceClosed,
} from "../src/lib/online-ordering";
import type { StoreSettings } from "@prisma/client";

const tz = "Asia/Karachi";

function at(iso: string) {
  return new Date(iso);
}

function week(slot: { open: string; close: string }): WeeklySchedule {
  const base = legacySchedule(9, 0, 23, 0);
  for (const day of Object.keys(base) as (keyof WeeklySchedule)[]) {
    base[day] = { closed: false, slots: [{ ...slot }] };
  }
  return base;
}

function settings(partial: Partial<StoreSettings>): StoreSettings {
  const schedule = week({ open: "09:00", close: "23:00" });
  return {
    id: "default",
    restaurantId: "default",
    forceClosed: false,
    timezone: tz,
    weeklySchedule: schedule,
    specialHours: [],
    closedMessage: "",
    onlineCloseReason: "",
    onlineClosedAt: null,
    onlineClosedByUserId: null,
    onlineReopenAt: null,
    lastOrderCutoffMinutes: 0,
    openHour: 9,
    openMinute: 0,
    closeHour: 23,
    closeMinute: 0,
    ...partial,
  } as StoreSettings;
}

describe("online ordering", () => {
  it("next opening is null while the kitchen is already open", () => {
    const schedule = week({ open: "09:00", close: "23:00" });
    const now = at("2026-09-28T05:00:00.000Z");
    expect(nextOpening(schedule, tz, now)).toBeNull();
  });

  it("force close blocks online but schedule stays open", () => {
    const now = at("2026-09-28T05:00:00.000Z");
    const s = settings({ forceClosed: true });
    expect(isScheduleOpen(s, now)).toBe(true);
    expect(isOnlineOrderingOpen(s, now)).toBe(false);
  });

  it("auto-reopen clears force close after the scheduled time", () => {
    const reopen = at("2026-09-28T04:00:00.000Z");
    const after = at("2026-09-28T05:00:00.000Z");
    const s = settings({ forceClosed: true, onlineReopenAt: reopen });
    expect(resolveForceClosed(s, after)).toBe(false);
    expect(isOnlineOrderingOpen(s, after)).toBe(true);
  });

  it("special day closure overrides weekly hours", () => {
    const now = at("2026-09-28T05:00:00.000Z");
    const s = settings({
      specialHours: [
        {
          id: "eid",
          label: "Holiday",
          startDate: "2026-09-28",
          closed: true,
        },
      ],
    });
    expect(isScheduleOpen(s, now)).toBe(false);
    expect(isOnlineOrderingOpen(s, now)).toBe(false);
  });

  it("last-order cutoff closes before the slot ends", () => {
    const schedule = week({ open: "09:00", close: "23:00" });
    const now = at("2026-09-28T17:50:00.000Z");
    const s = settings({ weeklySchedule: schedule, lastOrderCutoffMinutes: 15 });
    expect(isOnlineOrderingOpen(s, now)).toBe(false);
    expect(isScheduleOpen(s, now)).toBe(true);
  });

  it("uses online close reason when force closed", () => {
    const s = settings({ forceClosed: true, onlineCloseReason: "Private event tonight" });
    const msg = onlineOrderingClosedMessage(s, at("2026-09-28T05:00:00.000Z"));
    expect(msg).toBe("Private event tonight");
  });
});
