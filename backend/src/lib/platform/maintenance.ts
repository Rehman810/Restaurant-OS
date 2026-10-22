import { loadPlatformSettings } from "./platform-settings";

let cache: { expires: number; active: boolean; message: string } | null = null;

export async function getMaintenanceState() {
  const now = Date.now();
  if (cache && cache.expires > now) {
    return { active: cache.active, message: cache.message };
  }
  const { data } = await loadPlatformSettings();
  const m = data.maintenance;
  let active = Boolean(m?.active);
  const message = m?.message?.trim() || "We are performing scheduled maintenance. Please try again shortly.";
  if (m?.startsAt) {
    const start = new Date(m.startsAt);
    if (now < start.getTime()) active = false;
  }
  if (m?.endsAt) {
    const end = new Date(m.endsAt);
    if (now > end.getTime()) active = false;
  }
  cache = { expires: now + 30_000, active, message };
  return { active, message };
}

export function invalidateMaintenanceCache() {
  cache = null;
}
