import { describe, expect, it } from "vitest";
import { InventoryUnit, StockMovementType } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { applyStockChange, getOrCreateBranchStock } from "../src/lib/inventory/ledger";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("[INV-10] concurrent stock deduction", () => {
  it("does not allow two parallel deductions below zero when negative stock is disabled", async () => {
    const branch = await prisma.branch.findFirst({ where: { isActive: true } });
    if (!branch) {
      console.warn("Skipping: no branch in DB");
      return;
    }
    const item = await prisma.inventoryItem.create({
      data: { name: `Concurrency test ${Date.now()}`, unit: InventoryUnit.PIECE, trackStock: true },
    });
    await getOrCreateBranchStock(branch.id, item.id);
    await applyStockChange({
      branchId: branch.id,
      itemId: item.id,
      type: StockMovementType.ADJUSTMENT,
      quantityDelta: 1,
      notes: "seed one unit",
    });

    const attempt = () =>
      applyStockChange({
        branchId: branch.id,
        itemId: item.id,
        type: StockMovementType.SALE_DEDUCTION,
        quantityDelta: -1,
        notes: "parallel sale",
      });

    const results = await Promise.allSettled([attempt(), attempt()]);
    const fulfilled = results.filter((r) => r.status === "fulfilled").length;
    const rejected = results.filter((r) => r.status === "rejected").length;
    expect(fulfilled).toBe(1);
    expect(rejected).toBe(1);

    const stock = await prisma.branchStock.findUnique({
      where: { branchId_itemId: { branchId: branch.id, itemId: item.id } },
    });
    expect(Number(stock?.quantity)).toBe(0);

    await prisma.inventoryItem.delete({ where: { id: item.id } }).catch(() => null);
  });
});
