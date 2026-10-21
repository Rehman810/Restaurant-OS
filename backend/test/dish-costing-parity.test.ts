import { describe, expect, it } from "vitest";
import { buildDishEconomics } from "../src/lib/costing/compute";
import { costingSettingsFromStore } from "../src/lib/costing/math";

/**
 * Ensures menu-recipe-cost and dish costing report use the same core math (buildDishEconomics).
 */
describe("costing module parity", () => {
  const settings = costingSettingsFromStore({
    foodCostTargetPercent: 32,
    foodCostHighPercent: 40,
    taxEnabled: false,
    taxPercent: 0,
    pricesIncludeTax: false,
  });

  it("matches margin and food cost for a fixed fixture", () => {
    const menu = { price: 350, discountPrice: null };
    const lines = [
      {
        itemId: "ing-1",
        quantity: 2,
        item: { id: "ing-1", name: "Chicken", unit: "kg", defaultCost: 50 },
      },
    ];
    const costs = new Map<string, number>([["ing-1", 71.05]]);
    const econ = buildDishEconomics(menu, lines, costs, 1, settings, null);
    expect(econ.recipeCostDisplay).toBe(142.1);
    expect(econ.foodCostPercent).toBeCloseTo(40.6, 1);
    expect(econ.marginPercent).toBeCloseTo(59.4, 1);
  });
});
