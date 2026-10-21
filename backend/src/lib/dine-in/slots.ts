import { coerceSchedule, isKitchenOpen, legacySchedule } from "../hours";
import { prisma } from "../prisma";

const BOOKING_HORIZON_DAYS = 60;
const SLOT_MINUTES = 30;

export async function loadBranchHours(branchId: string) {
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  const settings = await prisma.storeSettings.findFirst();
  const schedule = coerceSchedule(settings?.weeklySchedule, {
    openHour: settings?.openHour ?? 19,
    openMinute: settings?.openMinute ?? 0,
    closeHour: settings?.closeHour ?? 2,
    closeMinute: settings?.closeMinute ?? 30,
  });
  return {
    timezone: branch?.timezone ?? settings?.timezone ?? "Asia/Karachi",
    schedule,
    forceClosed: settings?.forceClosed ?? false,
  };
}

export function listAvailableSlotStarts(
  dateYmd: string,
  timezone: string,
  schedule: ReturnType<typeof coerceSchedule>,
  forceClosed: boolean,
  partySize: number,
  tableCapacities: number[],
  now: Date
): string[] {
  if (!tableCapacities.some((c) => c >= partySize)) return [];
  const maxCap = Math.max(...tableCapacities, 0);
  if (partySize > maxCap) return [];

  const horizon = new Date(now.getTime() + BOOKING_HORIZON_DAYS * 24 * 60 * 60_000);
  const slots: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      const local = `${dateYmd}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
      const utc = new Date(local + "Z");
      if (utc <= now || utc > horizon) continue;
      if (!isKitchenOpen({ forceClosed: false, timezone, schedule }, utc)) continue;
      slots.push(utc.toISOString());
    }
  }
  return slots;
}
