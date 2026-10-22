import type { StoreSettings } from "@prisma/client";

export const AREA_NAME_MIN = 2;
export const AREA_NAME_MAX = 60;

export function slugifyAreaName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function normalizeCovers(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const v = String(item ?? "").trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

export function parseMoneyInt(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

export type AreaFieldErrors = Record<string, string>;

export function validateAreaFields(
  input: {
    name?: string;
    charge?: number;
    minOrder?: number | null;
    freeAbove?: number | null;
    etaMinMinutes?: number | null;
    etaMaxMinutes?: number | null;
    covers?: string[];
  },
  settings: Pick<StoreSettings, "deliveryChargeSanityLimit">
): AreaFieldErrors {
  const errors: AreaFieldErrors = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length < AREA_NAME_MIN || name.length > AREA_NAME_MAX) {
      errors.name = `Name must be ${AREA_NAME_MIN}–${AREA_NAME_MAX} characters.`;
    }
  }
  if (input.charge !== undefined) {
    if (!Number.isFinite(input.charge) || input.charge < 0) {
      errors.charge = "Charge must be zero or greater.";
    } else if (input.charge > settings.deliveryChargeSanityLimit) {
      errors.chargeWarning = `Charge is above Rs ${settings.deliveryChargeSanityLimit} — confirm before saving.`;
    }
  }
  if (input.minOrder != null && input.minOrder < 0) {
    errors.minOrder = "Minimum order must be zero or greater.";
  }
  if (
    input.freeAbove != null &&
    input.minOrder != null &&
    input.freeAbove > 0 &&
    input.freeAbove <= input.minOrder
  ) {
    errors.freeAbove = "Free-delivery threshold must be greater than minimum order.";
  }
  if (input.etaMinMinutes != null && input.etaMaxMinutes != null) {
    if (input.etaMinMinutes < 0 || input.etaMaxMinutes < 0) {
      errors.eta = "ETA must be zero or greater.";
    } else if (input.etaMinMinutes > input.etaMaxMinutes) {
      errors.eta = "ETA minimum cannot exceed maximum.";
    }
  }
  return errors;
}
