import { randomUUID } from "crypto";
import { afterAll, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { basePrisma, prisma } from "../src/lib/prisma";
import { runWithRestaurant, withoutTenant } from "../src/lib/restaurant-context";
import { nextCounter } from "../src/lib/counters";

const hasDb = Boolean(process.env.DATABASE_URL);
const suffix = randomUUID().slice(0, 8);
const tenantA = "11111111-1111-4111-8111-111111111111";
const tenantB = randomUUID();

async function ensureTenantB() {
  await withoutTenant("isolation fixture creates a second restaurant", async () => {
    await prisma.restaurant.upsert({
      where: { id: tenantB },
      create: { id: tenantB, slug: `iso-${suffix}`, displayName: "Isolation B" },
      update: {},
    });
  });
}

describe.skipIf(!hasDb)("tenant isolation", () => {
  afterAll(async () => {
    await basePrisma.category.deleteMany({ where: { name: { startsWith: `Iso ${suffix}` } } });
    await basePrisma.tenantCounter.deleteMany({ where: { periodKey: `p-${suffix}` } });
    await basePrisma.restaurant.deleteMany({ where: { id: tenantB } });
  });

  it("scopes reads, writes, and unique names per restaurant", async () => {
    await ensureTenantB();
    const name = `Iso ${suffix}`;

    const createdA = await runWithRestaurant(tenantA, async () =>
      prisma.category.create({ data: { name, restaurantId: tenantB } })
    );
    expect(createdA.restaurantId).toBe(tenantA);

    const createdB = await runWithRestaurant(tenantB, async () => prisma.category.create({ data: { name } }));
    expect(createdB.restaurantId).toBe(tenantB);

    const visibleToA = await runWithRestaurant(tenantA, async () => prisma.category.findMany({ where: { name } }));
    expect(visibleToA.map((row) => row.id)).toEqual([createdA.id]);

    const hidden = await runWithRestaurant(tenantA, async () =>
      prisma.category.findUnique({ where: { id: createdB.id } })
    );
    expect(hidden).toBeNull();

    await expect(
      runWithRestaurant(tenantA, async () =>
        prisma.category.update({ where: { id: createdB.id }, data: { tagline: "nope" } })
      )
    ).rejects.toMatchObject({ code: "P2025" });

    await expect(
      runWithRestaurant(tenantA, async () => prisma.category.create({ data: { name } }))
    ).rejects.toBeTruthy();
  });

  it("allocates counters independently per restaurant under concurrency", async () => {
    await ensureTenantB();
    const period = `p-${suffix}`;
    const run = (restaurantId: string) =>
      runWithRestaurant(restaurantId, async () =>
        nextCounter({ name: "kot", branchId: "branch-iso", periodKey: period, floor: 10 })
      );

    const values = await Promise.all([run(tenantA), run(tenantA), run(tenantB), run(tenantB)]);
    const aValues = values.filter((_, index) => index < 2).sort((a, b) => a - b);
    const bValues = values.filter((_, index) => index >= 2).sort((a, b) => a - b);
    expect(new Set(aValues).size).toBe(2);
    expect(bValues[1]! - bValues[0]!).toBe(1);
    expect(aValues[1]! - aValues[0]!).toBe(1);
    const rows = await basePrisma.tenantCounter.findMany({
      where: { periodKey: period },
      select: { restaurantId: true, lastValue: true },
    });
    expect(rows.map((row) => row.restaurantId).sort()).toEqual([tenantA, tenantB].sort());
  });

  it("raw tenant SQL requires a restaurant context", async () => {
    const previous = process.env.SINGLE_TENANT_MODE;
    process.env.SINGLE_TENANT_MODE = "false";
    const { tenantQueryRaw } = await import("../src/lib/tenant-sql");
    await expect(tenantQueryRaw(basePrisma, Prisma.sql`SELECT 1`)).rejects.toMatchObject({
      code: "TENANT_CONTEXT_REQUIRED",
    });
    if (previous === undefined) delete process.env.SINGLE_TENANT_MODE;
    else process.env.SINGLE_TENANT_MODE = previous;
  });
});
