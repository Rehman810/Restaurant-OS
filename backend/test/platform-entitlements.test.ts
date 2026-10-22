import { describe, expect, it } from "vitest";
import { basePrisma } from "../src/lib/prisma-base";
import { DEFAULT_RESTAURANT_ID, runWithRestaurant } from "../src/lib/restaurant-context";
import { assertCanAddBranch, EntitlementError, loadTenantEntitlements } from "../src/lib/platform/entitlements";

const hasDb = Boolean(process.env.DATABASE_URL?.includes("test"));

describe.skipIf(!hasDb)("platform entitlements", () => {
  it("loads growth plan entitlements for tenant #1", async () => {
    const ent = await runWithRestaurant(DEFAULT_RESTAURANT_ID, () => loadTenantEntitlements());
    expect(ent.maxBranches).toBeGreaterThanOrEqual(1);
    expect(ent.pos).toBe(true);
  });

  it("blocks a new branch when the starter plan branch limit is reached", async () => {
    const starter = await basePrisma.plan.findUnique({ where: { slug: "starter" } });
    expect(starter).toBeTruthy();
    await basePrisma.subscription.update({
      where: { restaurantId: DEFAULT_RESTAURANT_ID },
      data: { planId: starter!.id },
    });
    const activeCount = await runWithRestaurant(DEFAULT_RESTAURANT_ID, () =>
      basePrisma.branch.count({ where: { isActive: true } })
    );
    const growth = await basePrisma.plan.findUnique({ where: { slug: "growth" } });
    expect(growth).toBeTruthy();
    try {
      if (activeCount < 1) {
        await runWithRestaurant(DEFAULT_RESTAURANT_ID, () =>
          basePrisma.branch.create({
            data: {
              name: "Entitlement probe",
              code: `ent-${Date.now()}`,
              isActive: true,
            },
          })
        );
      }
      await expect(runWithRestaurant(DEFAULT_RESTAURANT_ID, () => assertCanAddBranch())).rejects.toBeInstanceOf(
        EntitlementError
      );
    } finally {
      await basePrisma.subscription.update({
        where: { restaurantId: DEFAULT_RESTAURANT_ID },
        data: { planId: growth!.id },
      });
    }
  });
});
