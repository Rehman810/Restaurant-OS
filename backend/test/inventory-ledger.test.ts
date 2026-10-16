import { describe, expect, it } from "vitest";
import { convertQuantity, roundQty, weightedAverageCost } from "../src/lib/inventory/units";
import { InventoryUnit } from "@prisma/client";

describe("inventory units", () => {
  it("converts g to kg", () => {
    expect(convertQuantity(500, InventoryUnit.G, InventoryUnit.KG)).toBe(0.5);
  });

  it("weighted average cost", () => {
    expect(weightedAverageCost(10, 100, 10, 200)).toBe(150);
  });

  it("rounds to 3 decimals", () => {
    expect(roundQty(1.23456)).toBe(1.235);
  });
});
