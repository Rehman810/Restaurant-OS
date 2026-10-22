import { describe, expect, it } from "vitest";
import { PlanInterval } from "@prisma/client";
import { effectiveMonthlyPricePkr } from "../src/lib/platform/effective-mrr";

describe("effectiveMonthlyPricePkr", () => {
  it("uses full monthly price for monthly plans", () => {
    expect(effectiveMonthlyPricePkr({ pricePkr: 12_000, interval: PlanInterval.MONTHLY })).toBe(12_000);
  });

  it("spreads yearly price across 12 months", () => {
    expect(effectiveMonthlyPricePkr({ pricePkr: 120_000, interval: PlanInterval.YEARLY })).toBe(10_000);
  });

  it("applies discount percent before interval normalization", () => {
    expect(effectiveMonthlyPricePkr({ pricePkr: 120_000, interval: PlanInterval.YEARLY }, 10)).toBe(9_000);
  });
});
