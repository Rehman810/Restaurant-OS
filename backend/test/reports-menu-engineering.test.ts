import { describe, expect, it } from "vitest";
import { OrderStatus } from "@prisma/client";
import { parseDateRangeQuery } from "../src/lib/reports/time-range";
import {
  MENU_ENGINEERING_COMPLETED_STATUSES,
  MENU_ENGINEERING_MIN_CLASSIFIED_ITEMS,
  MENU_ENGINEERING_MIN_TOTAL_UNITS,
  MENU_ENGINEERING_POPULARITY_FACTOR,
  classifyMenuEngineeringItem,
  computeMenuEngineeringThresholds,
} from "../src/lib/reports/menu-engineering";

describe("[RPT-01] menu engineering classification (Kasavana–Smith)", () => {
  it("uses 70% equal-share popularity and quantity-weighted average CM", () => {
    const n = 3;
    const totalUnits = 6;
    const thresholds = computeMenuEngineeringThresholds(n, totalUnits, 2400);
    expect(thresholds.popularityShareThreshold).toBeCloseTo(
      MENU_ENGINEERING_POPULARITY_FACTOR / n,
      5
    );
    expect(thresholds.weightedAvgMarginPerUnit).toBe(400);

    // qty 4/6 share — high pop; qty 1/6 — not popular at 23.3% threshold
    expect(
      classifyMenuEngineeringItem(4, totalUnits, 500, thresholds)
    ).toBe("STAR");
    expect(
      classifyMenuEngineeringItem(1, totalUnits, 500, thresholds)
    ).toBe("PUZZLE");
    expect(
      classifyMenuEngineeringItem(1, totalUnits, 100, thresholds)
    ).toBe("DOG");
  });

  it("classifies at exact popularity and margin boundaries", () => {
    const thresholds = computeMenuEngineeringThresholds(10, 100, 5000);
    const shareThreshold = thresholds.popularityShareThreshold;
    const marginThreshold = thresholds.weightedAvgMarginPerUnit;
    const qtyAtThreshold = Math.ceil(shareThreshold * 100);

    expect(
      classifyMenuEngineeringItem(qtyAtThreshold, 100, marginThreshold, thresholds)
    ).toBe("STAR");
    expect(
      classifyMenuEngineeringItem(qtyAtThreshold - 1, 100, marginThreshold, thresholds)
    ).not.toBe("STAR");
    expect(
      classifyMenuEngineeringItem(50, 100, marginThreshold, thresholds)
    ).toBe("STAR");
    expect(
      classifyMenuEngineeringItem(50, 100, marginThreshold - 0.01, thresholds)
    ).toBe("PLOWHORSE");
  });

  it("minimum-data guard toggles at item and unit thresholds", () => {
    const lowItems = computeMenuEngineeringThresholds(
      MENU_ENGINEERING_MIN_CLASSIFIED_ITEMS - 1,
      MENU_ENGINEERING_MIN_TOTAL_UNITS,
      1000
    );
    expect(lowItems.hasEnoughData).toBe(false);

    const lowUnits = computeMenuEngineeringThresholds(
      MENU_ENGINEERING_MIN_CLASSIFIED_ITEMS,
      MENU_ENGINEERING_MIN_TOTAL_UNITS - 1,
      1000
    );
    expect(lowUnits.hasEnoughData).toBe(false);

    const ok = computeMenuEngineeringThresholds(
      MENU_ENGINEERING_MIN_CLASSIFIED_ITEMS,
      MENU_ENGINEERING_MIN_TOTAL_UNITS,
      1000
    );
    expect(ok.hasEnoughData).toBe(true);
  });

  it("counts only completed terminal order statuses", () => {
    expect(MENU_ENGINEERING_COMPLETED_STATUSES).toEqual([
      OrderStatus.DELIVERED,
      OrderStatus.COLLECTED,
      OrderStatus.SERVED,
    ]);
    expect(MENU_ENGINEERING_COMPLETED_STATUSES).not.toContain(OrderStatus.CANCELLED);
    expect(MENU_ENGINEERING_COMPLETED_STATUSES).not.toContain(OrderStatus.PREPARING);
  });
});

describe("[RPT-01b] menu engineering default date range", () => {
  it("defaults empty query to a multi-day window ending today", () => {
    const tz = "Asia/Karachi";
    const { from, to, startUtc, endUtc } = parseDateRangeQuery(undefined, undefined, tz, 30);
    expect(from).not.toBe(to);
    expect(endUtc.getTime()).toBeGreaterThan(startUtc.getTime());
    const spanDays =
      (endUtc.getTime() - startUtc.getTime()) / (24 * 60 * 60 * 1000);
    expect(spanDays).toBeGreaterThanOrEqual(28);
  });

  it("treats explicit from-only as a single day", () => {
    const { from, to } = parseDateRangeQuery("2026-10-01", undefined, "Asia/Karachi", 30);
    expect(from).toBe("2026-10-01");
    expect(to).toBe("2026-10-01");
  });
});
