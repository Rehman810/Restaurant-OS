import { notifyStockLevel } from "../notifications/ops";

/** Emit socket notifications when quantity crosses reorder / zero thresholds. */
export function maybeEmitStockAlerts(input: {
  branchId: string;
  itemId: string;
  itemName: string;
  unit: string;
  reorderPoint: number;
  oldQty: number;
  newQty: number;
}) {
  const reorder = input.reorderPoint;
  const wasOut = input.oldQty <= 0;
  const isOut = input.newQty <= 0;
  const wasLow = input.oldQty > 0 && input.oldQty <= reorder;
  const isLow = input.newQty > 0 && input.newQty <= reorder;

  if (!wasOut && isOut) {
    notifyStockLevel({
      branchId: input.branchId,
      itemId: input.itemId,
      itemName: input.itemName,
      unit: input.unit,
      quantity: input.newQty,
      reorderPoint: reorder,
      kind: "inventory_out_of_stock",
    });
    return;
  }

  if (!wasLow && isLow) {
    notifyStockLevel({
      branchId: input.branchId,
      itemId: input.itemId,
      itemName: input.itemName,
      unit: input.unit,
      quantity: input.newQty,
      reorderPoint: reorder,
      kind: "inventory_low_stock",
    });
    return;
  }

  if ((wasOut || wasLow) && input.newQty > reorder) {
    notifyStockLevel({
      branchId: input.branchId,
      itemId: input.itemId,
      itemName: input.itemName,
      unit: input.unit,
      quantity: input.newQty,
      reorderPoint: reorder,
      kind: "inventory_restocked",
    });
  }
}
