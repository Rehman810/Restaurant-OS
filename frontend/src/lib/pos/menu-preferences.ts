export type PosMenuDensity = "grid" | "compact";

const DENSITY_KEY = "pos-menu-density";
const PIN_KEY_PREFIX = "pos-menu-pins:";

export function readPosMenuDensity(): PosMenuDensity {
  if (typeof window === "undefined") return "grid";
  return localStorage.getItem(DENSITY_KEY) === "compact" ? "compact" : "grid";
}

export function writePosMenuDensity(density: PosMenuDensity) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DENSITY_KEY, density);
  window.dispatchEvent(new CustomEvent("pos-menu-density-change"));
}

export function readPinnedMenuIds(branchKey: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${PIN_KEY_PREFIX}${branchKey}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writePinnedMenuIds(branchKey: string, ids: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${PIN_KEY_PREFIX}${branchKey}`, JSON.stringify(ids.slice(0, 24)));
  window.dispatchEvent(new CustomEvent("pos-menu-pins-change"));
}

export function togglePinnedMenuId(branchKey: string, menuItemId: string) {
  const cur = readPinnedMenuIds(branchKey);
  const next = cur.includes(menuItemId) ? cur.filter((id) => id !== menuItemId) : [...cur, menuItemId];
  writePinnedMenuIds(branchKey, next);
  return next;
}

export function itemInitial(name: string) {
  const t = name.trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return t.slice(0, 2).toUpperCase();
}
