import { describe, expect, it } from "vitest";
import { bandLabel, canShowMargin, formatCostMoney, formatPercent1, needsRecipeCheck, statusLabel } from "./helpers";

describe("dish costing helpers", () => {
  it("formats cost with two decimals", () => {
    expect(formatCostMoney("Rs", 142.1)).toBe("Rs 142.10");
  });

  it("formats percent", () => {
    expect(formatPercent1(40.57)).toBe("40.6%");
  });

  it("maps bands and status", () => {
    expect(bandLabel("HEALTHY")).toBe("On target");
    expect(statusLabel("INCOMPLETE")).toBe("Check recipe");
    expect(needsRecipeCheck("SUSPICIOUS_LOW")).toBe(true);
    expect(needsRecipeCheck("COMPLETE", 8)).toBe(true);
    expect(needsRecipeCheck("COMPLETE", 20)).toBe(false);
    expect(canShowMargin("INCOMPLETE")).toBe(false);
  });
});
