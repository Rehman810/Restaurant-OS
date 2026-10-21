export { applyStockChange, getOrCreateBranchStock, expiringBatches } from "./ledger";
export { deductInventoryForOrder, reverseInventoryForOrder, shouldDeductOnStatus } from "./orders";
export { refreshMenuAvailabilityForBranch } from "./availability";

import { prisma } from "../prisma";
import { stockLevel } from "./stock-status";

export async function lowStockForBranch(branchId: string) {
  const stocks = await prisma.branchStock.findMany({
    where: { branchId },
    include: { item: true },
  });
  return stocks
    .filter(
      (s) =>
        s.item.isActive &&
        s.item.trackStock &&
        stockLevel(Number(s.quantity), Number(s.item.reorderPoint)) !== "OK"
    )
    .map((s) => ({
      itemId: s.itemId,
      name: s.item!.name,
      quantity: Number(s.quantity),
      reorderPoint: Number(s.item!.reorderPoint),
      unit: s.item!.unit,
    }));
}
