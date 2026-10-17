import { describe, expect, it } from "vitest";
import { compareKpi, deltaPercent } from "../src/lib/dashboard/kpi";

describe("dashboard kpi deltas", () => {
  it("returns new when previous is zero and current is positive", () => {
    const d = deltaPercent(10, 0);
    expect(d.pct).toBeNull();
    expect(d.label).toBe("new");
  });

  it("returns flat when both zero", () => {
    const d = deltaPercent(0, 0);
    expect(d.pct).toBeNull();
    expect(d.label).toBe("flat");
  });

  it("computes percentage change", () => {
    const d = deltaPercent(150, 100);
    expect(d.pct).toBe(50);
    expect(d.label).toBeNull();
  });

  it("compareKpi bundles yesterday and same weekday", () => {
    const k = compareKpi(20, 10, 0);
    expect(k.value).toBe(20);
    expect(k.deltaYesterdayPercent).toBe(100);
    expect(k.deltaSameWeekdayLabel).toBe("new");
  });
});
