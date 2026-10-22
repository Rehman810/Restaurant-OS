import { randomUUID } from "crypto";
import { afterAll, describe, expect, it } from "vitest";
import { basePrisma } from "../src/lib/prisma";
import { withoutTenant } from "../src/lib/restaurant-context";
import { prisma } from "../src/lib/prisma";

const hasDb = Boolean(process.env.DATABASE_URL);
const suffix = randomUUID().slice(0, 8);
const tenantA = "11111111-1111-4111-8111-111111111111";
const tenantB = randomUUID();

describe.skipIf(!hasDb)("row level security", () => {
  afterAll(async () => {
    await basePrisma.category.deleteMany({ where: { name: { startsWith: `Rls ${suffix}` } } });
    await basePrisma.restaurant.deleteMany({ where: { id: tenantB } });
  });

  it("as restaurant_app, a tenant sees only its rows and cannot write another tenant", async () => {
    await withoutTenant("rls fixture", async () => {
      await prisma.restaurant.upsert({
        where: { id: tenantB },
        create: { id: tenantB, slug: `rls-${suffix}`, displayName: "RLS B" },
        update: {},
      });
      await basePrisma.category.create({
        data: { name: `Rls ${suffix} A`, restaurantId: tenantA },
      });
      await basePrisma.category.create({
        data: { name: `Rls ${suffix} B`, restaurantId: tenantB },
      });
    });

    const started = Date.now();
    const seen = await basePrisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL ROLE restaurant_app");
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantA}, true)`;
      return tx.$queryRaw<Array<{ name: string }>>`
        SELECT name FROM "Category" WHERE name LIKE ${"Rls " + suffix + "%"} ORDER BY name
      `;
    });
    const scopedMs = Date.now() - started;

    expect(seen.map((row) => row.name)).toEqual([`Rls ${suffix} A`]);

    await expect(
      basePrisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL ROLE restaurant_app");
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantA}, true)`;
        await tx.$executeRaw`
          INSERT INTO "Category" ("id", "restaurantId", "name", "createdAt")
          VALUES (${randomUUID()}, ${tenantB}, ${"Rls " + suffix + " leak"}, CURRENT_TIMESTAMP)
        `;
      })
    ).rejects.toThrow();

    const unscoped = await basePrisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL ROLE restaurant_app");
      return tx.$queryRaw<Array<{ name: string }>>`
        SELECT name FROM "Category" WHERE name LIKE ${"Rls " + suffix + "%"}
      `;
    });
    expect(unscoped).toEqual([]);

    const plainStarted = Date.now();
    await basePrisma.category.findMany({ where: { name: { startsWith: `Rls ${suffix}` } }, take: 20 });
    const plainMs = Date.now() - plainStarted;
    console.info(`[rls] scoped select ${scopedMs}ms, owner select ${plainMs}ms (single small query)`);
  });
});
