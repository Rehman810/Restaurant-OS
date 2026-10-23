import { describe, expect, it } from "vitest";
import { SubscriptionStatus, TenantStatus } from "@prisma/client";
import { basePrisma } from "../src/lib/prisma-base";
import { normalizeTenantSlug, provisionTenant } from "../src/lib/platform/provision";

const hasDb = Boolean(process.env.DATABASE_URL?.includes("test"));

describe("normalizeTenantSlug", () => {
  it("normalizes and validates slugs", () => {
    expect(normalizeTenantSlug("My Store!")).toBe("my-store");
    expect(() => normalizeTenantSlug("a")).toThrow();
  });
});

describe.skipIf(!hasDb)("provisionTenant", () => {
  it("creates restaurant, settings, branch, and subscription in one transaction", async () => {
    const slug = `prov-${Date.now()}`;
    const result = await provisionTenant({
      slug,
      displayName: "Provision Test Cafe",
      ownerEmail: `${slug}@test.local`,
      ownerPassword: "provision-test-pass-12",
      ownerName: "Owner",
      city: "Lahore",
      seedDeliveryAreas: false,
      seedStarterMenu: false,
    });

    expect(result.restaurant.slug).toBe(slug);
    expect(result.restaurant.status).toBe(TenantStatus.TRIAL);
    expect(result.ownerUserId).toBeTruthy();

    const sub = await basePrisma.subscription.findUnique({
      where: { restaurantId: result.restaurant.id },
      include: { plan: true },
    });
    expect(sub?.status).toBe(SubscriptionStatus.TRIALING);
    expect(sub?.plan.slug).toBe("growth");

    const branchCount = await basePrisma.branch.count({ where: { restaurantId: result.restaurant.id } });
    expect(branchCount).toBe(1);

    const settings = await basePrisma.storeSettings.findUnique({ where: { id: result.restaurant.id } });
    expect(settings?.storeName).toBe("Provision Test Cafe");

    const rid = result.restaurant.id;
    await basePrisma.branchMember.deleteMany({ where: { branch: { restaurantId: rid } } });
    await basePrisma.user.deleteMany({ where: { restaurantId: rid } });
    await basePrisma.branch.deleteMany({ where: { restaurantId: rid } });
    await basePrisma.subscription.delete({ where: { restaurantId: rid } });
    await basePrisma.storeSettings.delete({ where: { id: rid } });
    await basePrisma.restaurant.delete({ where: { id: rid } });
  });
});
