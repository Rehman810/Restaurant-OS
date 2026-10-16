import { InventoryUnit } from "@prisma/client";

/** Convert quantity to base unit (KG, L, PIECE) for comparisons. */
const TO_BASE: Record<InventoryUnit, { base: InventoryUnit; factor: number }> = {
  KG: { base: InventoryUnit.KG, factor: 1 },
  G: { base: InventoryUnit.KG, factor: 0.001 },
  L: { base: InventoryUnit.L, factor: 1 },
  ML: { base: InventoryUnit.L, factor: 0.001 },
  PIECE: { base: InventoryUnit.PIECE, factor: 1 },
  PACK: { base: InventoryUnit.PIECE, factor: 1 },
  DOZEN: { base: InventoryUnit.PIECE, factor: 12 },
};

export function unitsCompatible(a: InventoryUnit, b: InventoryUnit) {
  return TO_BASE[a].base === TO_BASE[b].base;
}

export function convertQuantity(qty: number, from: InventoryUnit, to: InventoryUnit) {
  if (from === to) return qty;
  if (!unitsCompatible(from, to)) {
    throw Object.assign(new Error(`Cannot convert ${from} to ${to}.`), { status: 400 });
  }
  const inBase = qty * TO_BASE[from].factor;
  return inBase / TO_BASE[to].factor;
}

export function roundQty(n: number) {
  return Math.round(n * 1000) / 1000;
}

export function weightedAverageCost(oldQty: number, oldAvg: number, addQty: number, addCost: number) {
  const totalQty = oldQty + addQty;
  if (totalQty <= 0) return addCost;
  return (oldQty * oldAvg + addQty * addCost) / totalQty;
}
