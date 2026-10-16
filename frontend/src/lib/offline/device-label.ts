const KEY = "pos-device-label";

export function getDeviceLabel(): string {
  if (typeof window === "undefined") return "Server";
  try {
    const stored = localStorage.getItem(KEY)?.trim();
    if (stored) return stored.slice(0, 40);
    const fallback = `POS-${navigator.userAgent.includes("Mobile") ? "M" : "D"}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    localStorage.setItem(KEY, fallback);
    return fallback;
  } catch {
    return "POS-UNKNOWN";
  }
}

export function setDeviceLabel(label: string) {
  try {
    localStorage.setItem(KEY, label.trim().slice(0, 40));
  } catch {
    /* ignore */
  }
}
