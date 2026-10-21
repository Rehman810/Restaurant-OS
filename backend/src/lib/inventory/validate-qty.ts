import { InventoryUnit } from "@prisma/client";
import { isPieceLikeUnit } from "./stock-status";

export function assertIntegerQtyForUnit(unit: InventoryUnit | string, qty: number, context = "Quantity") {
  if (!isPieceLikeUnit(unit)) return;
  if (!Number.isFinite(qty) || Math.abs(qty - Math.round(qty)) > 1e-6) {
    throw Object.assign(new Error(`${context} must be a whole number for ${unit}.`), { status: 400 });
  }
}

export function purchaseToStockQty(
  purchaseQty: number,
  purchaseUnit: InventoryUnit | null | undefined,
  stockUnit: InventoryUnit,
  conversionFactor: number
) {
  const factor = conversionFactor > 0 ? conversionFactor : 1;
  if (!purchaseUnit || purchaseUnit === stockUnit) return purchaseQty;
  return purchaseQty * factor;
}

export function purchaseUnitCostToStockCost(
  purchaseUnitCost: number,
  purchaseUnit: InventoryUnit | null | undefined,
  stockUnit: InventoryUnit,
  conversionFactor: number
) {
  const factor = conversionFactor > 0 ? conversionFactor : 1;
  if (!purchaseUnit || purchaseUnit === stockUnit) return purchaseUnitCost;
  return purchaseUnitCost / factor;
}

/** Recipe uses piece-like counts but ingredient is stocked in packs. */
export function recipeNeedsUnitCheck(
  stockUnit: InventoryUnit,
  recipeQtyPerPortion: number,
  purchaseUnit: InventoryUnit | null | undefined
) {
  if (stockUnit !== InventoryUnit.PACK) return false;
  const pu = purchaseUnit ?? stockUnit;
  if (pu === InventoryUnit.PIECE && recipeQtyPerPortion >= 0.5 && recipeQtyPerPortion <= 4) return true;
  if (recipeQtyPerPortion > 0 && recipeQtyPerPortion < 1) return true;
  return false;
}
