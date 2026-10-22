import { describe, expect, it } from "vitest";
import { basePrisma } from "../src/lib/prisma-base";
import { rollupTenantUsageForDay } from "../src/lib/platform/usage-rollup";
import { runWithRestaurant } from "../src/lib/restaurant-context";
import { aggregatePeriodOrderMetrics } from "../src/lib/metrics/period-stats";
import { karachiDayRangeUtc } from "../src/lib/platform/karachi-time";
import { DEFAULT_RESTAURANT_ID } from "../src/lib/restaurant-context";

const hasDb = Boolean(process.env.DATABASE_URL?.includes("test"));

describe.skipIf(!hasDb)("usage rollup", () => {
  it("matches shared dashboard metrics for today", async () => {
    const ref = new Date();
    const { startUtc, endUtc } = karachiDayRangeUtc(ref);
    const metrics = await runWithRestaurant(DEFAULT_RESTAURANT_ID, () =>
      aggregatePeriodOrderMetrics({}, startUtc, endUtc)
    );
    await rollupTenantUsageForDay(DEFAULT_RESTAURANT_ID, ref);
    const row = await basePrisma.tenantUsageDaily.findFirst({
      where: { restaurantId: DEFAULT_RESTAURANT_ID },
      orderBy: { usageDate: "desc" },
    });
    expect(row?.ordersCount).toBe(metrics.ordersCount);
    expect(row?.bookedPkr).toBe(Math.round(metrics.booked));
    expect(row?.collectedPkr).toBe(Math.round(metrics.collected));
  });
});
