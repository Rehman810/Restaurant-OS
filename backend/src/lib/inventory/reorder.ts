import { roundQty } from "./units";

export function reorderTargetQty(parLevel: number | null | undefined, reorderPoint: number) {
  if (parLevel != null && parLevel > 0) return parLevel;
  return reorderPoint * 2;
}

export function suggestedReorderQty(onHand: number, parLevel: number | null | undefined, reorderPoint: number) {
  const target = reorderTargetQty(parLevel, reorderPoint);
  return Math.max(0, roundQty(target - onHand));
}
