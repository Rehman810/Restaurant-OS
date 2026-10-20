const TRACKING_TV_KEY = "uff-tracking-tv";

export function readTrackingTv(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(TRACKING_TV_KEY) === "1";
  } catch {
    return false;
  }
}

export function setTrackingTv(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(TRACKING_TV_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event("tracking-tv-change"));
}
