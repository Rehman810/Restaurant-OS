/** Canonical on-hand level for KPIs, badges, chips, and reorder lists. */
export type StockLevel = "OK" | "LOW" | "OUT";

export function stockLevel(qty: number, reorderPoint: number): StockLevel {
  if (qty <= 0) return "OUT";
  if (qty <= reorderPoint) return "LOW";
  return "OK";
}

export type InventoryDisplayStatus = "ok" | "low" | "out" | "expiring";

/** UI status: out/low take precedence; expiring only when otherwise OK. */
export function inventoryDisplayStatus(
  qty: number,
  reorderPoint: number,
  expiringSoon: boolean
): InventoryDisplayStatus {
  const level = stockLevel(qty, reorderPoint);
  if (level === "OUT") return "out";
  if (level === "LOW") return "low";
  if (expiringSoon) return "expiring";
  return "ok";
}

export function countLowAndOut(
  rows: { quantity: number; reorderPoint: number }[]
): { lowCount: number; outCount: number; alertCount: number } {
  let lowCount = 0;
  let outCount = 0;
  for (const r of rows) {
    const level = stockLevel(r.quantity, r.reorderPoint);
    if (level === "OUT") outCount++;
    else if (level === "LOW") lowCount++;
  }
  return { lowCount, outCount, alertCount: lowCount + outCount };
}

export const LOW_FOOD_COST_PCT = 15;

const PIECE_LIKE = new Set(["PIECE", "PACK", "BOX"]);

export function isPieceLikeUnit(unit: string) {
  return PIECE_LIKE.has(unit);
}

export function hasFractionalPieceQty(qty: number) {
  return Math.abs(qty - Math.round(qty)) > 1e-6;
}

export function needsUnitReview(unit: string, qty: number) {
  return isPieceLikeUnit(unit) && hasFractionalPieceQty(qty);
}
