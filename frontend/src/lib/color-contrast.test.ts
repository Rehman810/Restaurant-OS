import { describe, expect, it } from "vitest";
import { brandContrastReport, contrastRatio, darkenUntilContrast } from "./color-contrast";

describe("color-contrast", () => {
  it("computes known ratio for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("darkens background until button contrast passes", () => {
    const light = "#fde68a";
    const fixed = darkenUntilContrast("#ffffff", light, 3, true);
    expect(fixed.ratio).toBeGreaterThanOrEqual(3);
  });

  it("flags weak primary text on white", () => {
    const report = brandContrastReport("#fde68a", "#c2410c");
    const textCheck = report.find((r) => r.id === "primary-text");
    expect(textCheck?.pass).toBe(false);
  });
});
