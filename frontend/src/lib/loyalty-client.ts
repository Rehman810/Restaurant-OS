import { StoreSettings } from "./types";

export function loyaltyRedeemPreview(
  pointsToRedeem: number,
  orderTotal: number,
  availablePoints: number,
  settings?: StoreSettings | null
) {
  const pts = Math.max(0, Math.floor(pointsToRedeem) || 0);
  if (!pts) return { points: 0, discount: 0 };
  const capped = Math.min(pts, availablePoints);
  const perPoint = Number(settings?.loyaltyRedeemPerPoint ?? 1);
  const maxPct = Number(settings?.loyaltyMaxRedeemPercent ?? 20);
  const maxDiscount = (orderTotal * maxPct) / 100;
  const discount = Math.min(capped * perPoint, maxDiscount, orderTotal);
  const pointsUsed = perPoint > 0 ? Math.min(capped, Math.ceil(discount / perPoint)) : 0;
  return { points: pointsUsed, discount: Math.round(discount * 100) / 100 };
}
