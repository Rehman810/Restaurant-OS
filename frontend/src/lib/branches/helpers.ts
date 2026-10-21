import type { BranchOpenState, DeactivationBlocker } from "@/modules/branches/types";

const CODE_RE = /^[A-Z0-9]{2,6}$/;

export function normalizeBranchCodeInput(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export function suggestBranchCodeFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  if (words.length === 1) return normalizeBranchCodeInput(words[0].slice(0, 6));
  return normalizeBranchCodeInput(words.map((w) => w[0]).join("").slice(0, 6));
}

export function validateBranchCodeClient(code: string): string | null {
  if (!code) return "Branch code is required.";
  if (!CODE_RE.test(code)) return "Use 2–6 letters or numbers (A–Z, 0–9).";
  return null;
}

export function formatStructuredAddress(parts: {
  addressLine?: string;
  area?: string;
  city?: string;
  address?: string;
}): string {
  const line = [parts.addressLine, parts.area, parts.city].map((s) => (s || "").trim()).filter(Boolean).join(", ");
  return line || (parts.address || "").trim();
}

export function mapsUrl(lat: number | null | undefined, lng: number | null | undefined): string | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}

export function openStatusLabel(open: BranchOpenState, isActive: boolean, acceptsOnlineOrders: boolean): string {
  if (!isActive) return "Inactive";
  if (!acceptsOnlineOrders) return "Online ordering off";
  if (open.isOpenNow) return open.nextCloseLabel ? `Open · ${open.nextCloseLabel}` : "Open now";
  return open.nextOpenLabel ? `Closed · ${open.nextOpenLabel}` : "Closed";
}

export function formatBlockerSummary(blockers: DeactivationBlocker[]): string {
  if (!blockers.length) return "";
  return blockers.map((b) => `${b.label} (${b.count})`).join("; ");
}

export function formatMoney(n: number, symbol = "Rs"): string {
  if (!Number.isFinite(n)) return "—";
  return `${symbol} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
