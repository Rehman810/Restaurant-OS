import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { basePrisma } from "../src/lib/prisma-base";
import { rollupTenantUsageForDay } from "../src/lib/platform/usage-rollup";
import {
  setupCrossTenantFixture,
  teardownCrossTenantFixture,
  type CrossTenantFixture,
} from "./helpers/isolation-fixture";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("scheduler / job tenant isolation", () => {
  const suffix = randomUUID().slice(0, 8);
  let fixture: CrossTenantFixture;

  beforeAll(async () => {
    fixture = await setupCrossTenantFixture(suffix);
  });

  afterAll(async () => {
    await teardownCrossTenantFixture(fixture);
  });

  it("usage rollup writes separate rows per tenant", async () => {
    const ref = new Date();
    await rollupTenantUsageForDay(fixture.tenantA, ref);
    await rollupTenantUsageForDay(fixture.tenantB, ref);
    const rows = await basePrisma.tenantUsageDaily.findMany({
      where: { restaurantId: { in: [fixture.tenantA, fixture.tenantB] } },
      orderBy: { restaurantId: "asc" },
    });
    const ids = new Set(rows.map((r) => r.restaurantId));
    expect(ids.has(fixture.tenantA)).toBe(true);
    expect(ids.has(fixture.tenantB)).toBe(true);
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });
});
