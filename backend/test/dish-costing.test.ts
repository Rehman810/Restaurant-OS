import { describe, expect, it } from "vitest";
import {
  classifyFoodCostBand,
  computeMarginMetrics,
  costingSettingsFromStore,
  csvGuardCell,
  netPriceFromGross,
  resolveDishStatus,
  roundMoney2,
  suggestedPriceFromCost,
} from "../src/lib/costing/math";
import { buildDishEconomics, computeRecipeFromLines } from "../src/lib/costing/compute";

const settings = costingSettingsFromStore({
  foodCostTargetPercent: 32,
  foodCostHighPercent: 40,
  suggestedPriceRoundingStep: 10,
  suspiciousLowCostFraction: 0.25,
  taxEnabled: true,
  taxPercent: 5,
  pricesIncludeTax: true,
});

describe("dish costing math", () => {
  it("uses net price when tax is inclusive", () => {
    const net = netPriceFromGross(350, settings);
    expect(net).toBe(roundMoney2(350 / 1.05));
    const { foodCostPercent } = computeMarginMetrics(141.75, net);
    expect(foodCostPercent).toBeCloseTo(42.5, 0);
  });

  it("keeps margin percent consistent with exact cost", () => {
    const net = 350;
    const cost = 142.1;
    const m = computeMarginMetrics(cost, net);
    expect(m.marginPercent).toBeCloseTo(((net - cost) / net) * 100, 1);
    expect(roundMoney2(cost)).toBe(142.1);
  });

  it("detects incomplete vs no recipe vs suspicious", () => {
    expect(resolveDishStatus(false, [], null, 100, 0.25)).toBe("NO_RECIPE");
    expect(resolveDishStatus(true, ["Sugar"], 10, 100, 0.25)).toBe("INCOMPLETE");
    expect(resolveDishStatus(true, [], 10, 100, 0.25)).toBe("SUSPICIOUS_LOW");
    expect(resolveDishStatus(true, [], 50, 100, 0.25)).toBe("COMPLETE");
  });

  it("classifies food cost bands at boundaries", () => {
    expect(classifyFoodCostBand(32, "COMPLETE", settings)).toBe("HEALTHY");
    expect(classifyFoodCostBand(40, "COMPLETE", settings)).toBe("WATCH");
    expect(classifyFoodCostBand(40.1, "COMPLETE", settings)).toBe("HIGH");
    expect(classifyFoodCostBand(10, "INCOMPLETE", settings)).toBe("UNKNOWN");
  });

  it("rounds suggested price up to step", () => {
    expect(suggestedPriceFromCost(100, 32, 10)).toBe(320);
    expect(suggestedPriceFromCost(13, 32, 10)).toBe(50);
  });

  it("guards csv formula injection", () => {
    expect(csvGuardCell("=SUM(1,1)")).toBe("'=SUM(1,1)");
  });
});

describe("combo-style recipe sum", () => {
  it("honors quantities in recipe lines", () => {
    const lines = [
      {
        itemId: "a",
        quantity: 2,
        item: { id: "a", name: "A", unit: "kg", defaultCost: 5 },
      },
      {
        itemId: "b",
        quantity: 1,
        item: { id: "b", name: "B", unit: "kg", defaultCost: 10 },
      },
    ];
    const map = new Map<string, number>();
    const { recipeCostExact } = computeRecipeFromLines(lines, map, 1);
    expect(recipeCostExact).toBe(20);
  });
});

describe("buildDishEconomics", () => {
  it("marks suspicious low with unknown band", () => {
    const menu = { price: 320, discountPrice: null };
    const lines = [
      {
        itemId: "mint",
        quantity: 0.02,
        item: { id: "mint", name: "Mint", unit: "kg", defaultCost: 50 },
      },
    ];
    const costs = new Map<string, number>([["mint", 50]]);
    const econ = buildDishEconomics(menu, lines, costs, 1, settings, 200);
    expect(econ.status).toBe("SUSPICIOUS_LOW");
    expect(econ.foodCostBand).toBe("UNKNOWN");
    expect(econ.marginPercent).not.toBeNull();
  });
});
