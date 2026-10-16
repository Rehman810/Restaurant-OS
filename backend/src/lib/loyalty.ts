import { toMinorUnits } from "./money";

export type LoyaltySettings = {
  loyaltyEarnPer100?: unknown;
  loyaltyRedeemPerPoint?: unknown;
  loyaltyMaxRedeemPercent?: unknown;
};

export function pointsEarnedForTotal(total: number, settings: LoyaltySettings) {
  const per100 = Number(settings.loyaltyEarnPer100 ?? 1);
  if (!Number.isFinite(per100) || per100 <= 0) return 0;
  return Math.floor((Number(total) / 100) * per100);
}

export function loyaltyRedeemDiscount(
  pointsToRedeem: number,
  orderTotalBeforeRedeem: number,
  availablePoints: number,
  settings: LoyaltySettings
) {
  const pts = Math.max(0, Math.floor(Number(pointsToRedeem) || 0));
  if (!pts) return { points: 0, discount: 0 };
  const maxPct = Number(settings.loyaltyMaxRedeemPercent ?? 20);
  const redeemValue = Number(settings.loyaltyRedeemPerPoint ?? 1);
  const cappedPts = Math.min(pts, availablePoints);
  const maxDiscountMinor = Math.round((toMinorUnits(orderTotalBeforeRedeem) * maxPct) / 100);
  let discountMinor = Math.round(cappedPts * toMinorUnits(redeemValue));
  discountMinor = Math.min(discountMinor, maxDiscountMinor, toMinorUnits(orderTotalBeforeRedeem));
  const pointsUsed =
    redeemValue > 0 ? Math.min(cappedPts, Math.ceil(discountMinor / toMinorUnits(redeemValue))) : 0;
  return { points: pointsUsed, discount: discountMinor / 100 };
}
