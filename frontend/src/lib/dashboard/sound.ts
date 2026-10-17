export const DASHBOARD_SOUND_KEY = "ros-dashboard-order-sound";

export function readDashboardSoundEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(DASHBOARD_SOUND_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeDashboardSoundEnabled(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) localStorage.setItem(DASHBOARD_SOUND_KEY, "1");
    else localStorage.removeItem(DASHBOARD_SOUND_KEY);
  } catch {
    /* ignore */
  }
}
