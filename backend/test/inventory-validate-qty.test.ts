import { describe, expect, it } from "vitest";
import { InventoryUnit } from "@prisma/client";
import {
  assertIntegerQtyForUnit,
  purchaseToStockQty,
  purchaseUnitCostToStockCost,
} from "../src/lib/inventory/validate-qty";

describe("purchase conversion", () => {
  it("converts packs to pieces", () => {
    expect(purchaseToStockQty(2, InventoryUnit.PACK, InventoryUnit.PIECE, 8)).toBe(16);
    expect(purchaseUnitCostToStockCost(80, InventoryUnit.PACK, InventoryUnit.PIECE, 8)).toBe(10);
  });
});

describe("assertIntegerQtyForUnit", () => {
  it("rejects fractional pieces", () => {
    expect(() => assertIntegerQtyForUnit(InventoryUnit.PIECE, 1.5)).toThrow(/whole number/);
  });
});
