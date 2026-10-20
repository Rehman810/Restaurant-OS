import { describe, expect, it } from "vitest";
import { computeAvgOrderValue } from "../src/lib/metrics/definitions";
import { withComparison } from "../src/lib/metrics/compare";
import { deltaPercent } from "../src/lib/dashboard/kpi";

describe("metric definitions", () => {
  it("avg order value uses collected / completed count", () => {
    expect(computeAvgOrderValue(1000, 4)).toBe(250);
    expect(computeAvgOrderValue(1000, 0)).toBe(0);
  });

  it("delta with zero previous is null not infinity", () => {
    expect(deltaPercent(10, 0).label).toBe("new");
    expect(deltaPercent(10, 0).pct).toBeNull();
    const w = withComparison(100, 0);
    expect(w.deltaPercent).toBeNull();
    expect(w.deltaLabel).toBe("new");
  });
});
