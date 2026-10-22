import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { CouponDiscountType, FulfillmentType, OrderStatus, Role } from "@prisma/client";
import { basePrisma } from "../../src/lib/prisma-base";
import { DEFAULT_RESTAURANT_ID, withoutTenant } from "../../src/lib/restaurant-context";
import { signToken } from "../../src/middleware/auth";
import { assertSafeToCreateTestUsers } from "../../src/lib/test-users";
import { registerTestUserId } from "./test-user-registry";

export type CrossTenantFixture = {
  suffix: string;
  slugA: string;
  slugB: string;
  tenantA: string;
  tenantB: string;
  branchBId: string;
  adminAId: string;
  adminAToken: string;
  adminBToken: string;
  orderBId: string;
  categoryBId: string;
  couponCode: string;
};

async function createPlatformUser(restaurantId: string, email: string, role: Role) {
  assertSafeToCreateTestUsers();
  const hash = await bcrypt.hash("test-pass-123", 10);
  const user = await basePrisma.user.create({
    data: {
      restaurantId,
      email,
      name: email.split("@")[0],
      role,
      passwordHash: hash,
      isActive: true,
      isTest: true,
    },
  });
  registerTestUserId(user.id);
  const token = signToken({
    id: user.id,
    role: user.role,
    email: user.email,
    name: user.name,
    tv: user.tokenVersion,
    rid: restaurantId,
  });
  return { user, token };
}

export async function setupCrossTenantFixture(suffix: string): Promise<CrossTenantFixture> {
  const tenantB = randomUUID();
  const slugB = `iso-${suffix}`;
  const slugA = "main";
  const couponCode = `ISO${suffix}`.slice(0, 12).toUpperCase();

  await withoutTenant("cross-tenant fixture", async () => {
    await basePrisma.restaurant.upsert({
      where: { id: tenantB },
      create: {
        id: tenantB,
        slug: slugB,
        displayName: `Isolation ${suffix}`,
      },
      update: { slug: slugB },
    });
    await basePrisma.storeSettings.upsert({
      where: { id: tenantB },
      create: { id: tenantB, restaurantId: tenantB, storeName: `Isolation ${suffix}` },
      update: {},
    });
  });

  const branchB = await basePrisma.branch.create({
    data: {
      restaurantId: tenantB,
      name: "Iso Branch B",
      code: `ib-${suffix}`,
      isActive: true,
      isDefault: true,
    },
  });

  const adminA = await createPlatformUser(DEFAULT_RESTAURANT_ID, `iso-admin-a-${suffix}@test.local`, Role.ADMIN);
  const adminB = await createPlatformUser(tenantB, `iso-admin-b-${suffix}@test.local`, Role.ADMIN);

  const categoryB = await basePrisma.category.create({
    data: { restaurantId: tenantB, name: `IsoCat ${suffix}` },
  });

  await basePrisma.coupon.create({
    data: {
      restaurantId: DEFAULT_RESTAURANT_ID,
      code: couponCode,
      type: CouponDiscountType.PERCENT,
      value: 10,
      isActive: true,
    },
  });
  await basePrisma.coupon.create({
    data: {
      restaurantId: tenantB,
      code: couponCode,
      type: CouponDiscountType.PERCENT,
      value: 10,
      isActive: true,
    },
  });

  const orderB = await basePrisma.order.create({
    data: {
      restaurantId: tenantB,
      orderNumber: `ISO-${suffix}`,
      branchId: branchB.id,
      status: OrderStatus.CONFIRMED,
      fulfillmentType: FulfillmentType.PICKUP,
      subtotal: 100,
      total: 100,
      customerName: "Iso B",
      customerPhone: "03001234567",
      deliveryAddress: "Pickup",
    },
  });

  return {
    suffix,
    slugA,
    slugB,
    tenantA: DEFAULT_RESTAURANT_ID,
    tenantB,
    branchBId: branchB.id,
    adminAId: adminA.user.id,
    adminAToken: adminA.token,
    adminBToken: adminB.token,
    orderBId: orderB.id,
    categoryBId: categoryB.id,
    couponCode,
  };
}

export async function teardownCrossTenantFixture(fixture: CrossTenantFixture) {
  await withoutTenant("cross-tenant teardown", async () => {
    await basePrisma.tenantUsageDaily.deleteMany({
      where: { restaurantId: { in: [fixture.tenantA, fixture.tenantB] } },
    });
    await basePrisma.order.deleteMany({ where: { id: fixture.orderBId } });
    await basePrisma.coupon.deleteMany({ where: { code: fixture.couponCode } });
    await basePrisma.category.deleteMany({ where: { name: `IsoCat ${fixture.suffix}` } });
    await basePrisma.user.deleteMany({
      where: {
        email: { in: [`iso-admin-a-${fixture.suffix}@test.local`, `iso-admin-b-${fixture.suffix}@test.local`] },
      },
    });
    await basePrisma.branch.deleteMany({ where: { id: fixture.branchBId } });
    await basePrisma.storeSettings.deleteMany({ where: { id: fixture.tenantB } });
    await basePrisma.restaurant.deleteMany({ where: { id: fixture.tenantB } });
  });
}
