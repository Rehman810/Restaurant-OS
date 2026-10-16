export { applyStockChange, getOrCreateBranchStock, expiringBatches } from "./ledger";
export { deductInventoryForOrder, reverseInventoryForOrder, shouldDeductOnStatus } from "./orders";
export { refreshMenuAvailabilityForBranch } from "./availability";

import { prisma } from "../prisma";

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
        Number(s.quantity) <= Number(s.item.reorderPoint)
    )
    .map((s) => ({
      itemId: s.itemId,
      name: s.item!.name,
      quantity: Number(s.quantity),
      reorderPoint: Number(s.item!.reorderPoint),
      unit: s.item!.unit,
    }));
}
