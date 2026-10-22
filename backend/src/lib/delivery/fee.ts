import type { StoreSettings } from "@prisma/client";

export type DeliveryFeeAreaInput = {
  deliveryCharge: number;
  minOrder?: number | null;
  freeAbove?: number | null;
  etaMinMinutes?: number | null;
  etaMaxMinutes?: number | null;
};

export type DeliveryFeeResult = {
  charge: number;
  freeApplied: boolean;
  minOrderMet: boolean;
  effectiveMinOrder: number;
  freeAbove: number | null;
  etaMinMinutes: number;
  etaMaxMinutes: number;
  reasons: string[];
};

export function effectiveMinOrder(area: DeliveryFeeAreaInput, settings: Pick<StoreSettings, "minimumOrder">) {
  if (area.minOrder != null && !Number.isNaN(Number(area.minOrder))) {
    return Math.max(0, Number(area.minOrder));
  }
  return Math.max(0, Number(settings.minimumOrder));
}

export function effectiveFreeAbove(
  area: DeliveryFeeAreaInput,
  settings: Pick<StoreSettings, "freeDeliveryAbove">
): number | null {
  if (area.freeAbove != null && !Number.isNaN(Number(area.freeAbove))) {
    const n = Number(area.freeAbove);
    return n > 0 ? n : null;
  }
  if (settings.freeDeliveryAbove == null) return null;
  const n = Number(settings.freeDeliveryAbove);
  return n > 0 ? n : null;
}

export function effectiveEta(
  area: DeliveryFeeAreaInput,
  settings: Pick<StoreSettings, "deliveryEstimateMin" | "deliveryEstimateMax">
) {
  const min =
    area.etaMinMinutes != null && area.etaMinMinutes > 0
      ? area.etaMinMinutes
      : settings.deliveryEstimateMin;
  const max =
    area.etaMaxMinutes != null && area.etaMaxMinutes > 0
      ? area.etaMaxMinutes
      : settings.deliveryEstimateMax ?? settings.deliveryEstimateMin;
  return { etaMinMinutes: min, etaMaxMinutes: Math.max(min, max) };
}

/** Single source for storefront, POS, and order validation. */
export function computeDeliveryFee(
  area: DeliveryFeeAreaInput,
  subtotal: number,
  settings: Pick<
    StoreSettings,
    "minimumOrder" | "freeDeliveryAbove" | "deliveryEstimateMin" | "deliveryEstimateMax"
  >
): DeliveryFeeResult {
  const sub = Math.max(0, Number(subtotal) || 0);
  const effectiveMin = effectiveMinOrder(area, settings);
  const minOrderMet = sub >= effectiveMin;
  const freeAbove = effectiveFreeAbove(area, settings);
  const baseCharge = Math.max(0, Math.round(Number(area.deliveryCharge) || 0));
  let charge = baseCharge;
  let freeApplied = false;
  if (freeAbove != null && sub >= freeAbove) {
    charge = 0;
    freeApplied = true;
  }
  const eta = effectiveEta(area, settings);
  const reasons: string[] = [];
  if (!minOrderMet) reasons.push("below_minimum");
  if (freeApplied) reasons.push("free_delivery");
  return {
    charge,
    freeApplied,
    minOrderMet,
    effectiveMinOrder: effectiveMin,
    freeAbove,
    etaMinMinutes: eta.etaMinMinutes,
    etaMaxMinutes: eta.etaMaxMinutes,
    reasons,
  };
}

export function amountUntilFreeDelivery(subtotal: number, freeAbove: number | null) {
  if (freeAbove == null || freeAbove <= 0) return null;
  const remaining = freeAbove - subtotal;
  if (remaining <= 0) return 0;
  return Math.ceil(remaining);
}
