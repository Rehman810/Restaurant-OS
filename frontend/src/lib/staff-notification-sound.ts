export const STAFF_NOTIFY_SOUND_KEY = "uff-staff-notify-sound";

/** Default on — staff bell / ops alerts should be audible unless turned off. */
export function readStaffNotificationSoundEnabled() {
  if (typeof window === "undefined") return true;
  try {
    const stored = localStorage.getItem(STAFF_NOTIFY_SOUND_KEY);
    if (stored === null) return true;
    return stored === "1";
  } catch {
    return true;
  }
}

export function writeStaffNotificationSoundEnabled(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) localStorage.setItem(STAFF_NOTIFY_SOUND_KEY, "1");
    else localStorage.setItem(STAFF_NOTIFY_SOUND_KEY, "0");
  } catch {
    /* ignore */
  }
}
