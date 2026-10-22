import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { appRequest } from "./helpers/app-request";
import { authHeader, tenantSlugHeader } from "./helpers/auth";
import {
  setupCrossTenantFixture,
  teardownCrossTenantFixture,
  type CrossTenantFixture,
} from "./helpers/isolation-fixture";
import { basePrisma } from "../src/lib/prisma-base";

const hasDb = Boolean(process.env.DATABASE_URL);
const app = createApp();

describe.skipIf(!hasDb)("cross-tenant HTTP isolation", () => {
  const suffix = randomUUID().slice(0, 8);
  let fixture: CrossTenantFixture;
  let prevSingle: string | undefined;

  beforeAll(async () => {
    prevSingle = process.env.SINGLE_TENANT_MODE;
    process.env.SINGLE_TENANT_MODE = "false";
    fixture = await setupCrossTenantFixture(suffix);
  });

  afterAll(async () => {
    if (fixture) await teardownCrossTenantFixture(fixture);
    if (prevSingle === undefined) delete process.env.SINGLE_TENANT_MODE;
    else process.env.SINGLE_TENANT_MODE = prevSingle;
  });

  function headersA(extra: Record<string, string> = {}) {
    return { ...authHeader(fixture.adminAToken), ...tenantSlugHeader(fixture.slugA), ...extra };
  }

  function headersB(extra: Record<string, string> = {}) {
    return { ...authHeader(fixture.adminBToken), ...tenantSlugHeader(fixture.slugB), ...extra };
  }

  it("rejects tenant A JWT on tenant B host", async () => {
    const res = await appRequest(app, "GET", "/admin/onboarding", {
      headers: { ...authHeader(fixture.adminAToken), ...tenantSlugHeader(fixture.slugB) },
    });
    expect(res.status).toBe(401);
  });

  it("rejects tenant B JWT on tenant A host", async () => {
    const res = await appRequest(app, "GET", "/admin/onboarding", {
      headers: { ...authHeader(fixture.adminBToken), ...tenantSlugHeader(fixture.slugA) },
    });
    expect(res.status).toBe(401);
  });

  it("tenant A admin cannot read tenant B order by id", async () => {
    const res = await appRequest(app, "GET", `/orders/${fixture.orderBId}`, {
      headers: headersA(),
    });
    expect([403, 404]).toContain(res.status);
  });

  it("tenant B admin can read tenant B order", async () => {
    const res = await appRequest(app, "GET", `/orders/${fixture.orderBId}`, {
      headers: headersB(),
    });
    expect(res.status).toBe(200);
  });

  it("allows the same coupon code in both tenants", async () => {
    const [a, b] = await Promise.all([
      basePrisma.coupon.findFirst({ where: { restaurantId: fixture.tenantA, code: fixture.couponCode } }),
      basePrisma.coupon.findFirst({ where: { restaurantId: fixture.tenantB, code: fixture.couponCode } }),
    ]);
    expect(a?.restaurantId).toBe(fixture.tenantA);
    expect(b?.restaurantId).toBe(fixture.tenantB);
  });

  it("public menu on tenant B slug does not include tenant A categories", async () => {
    const res = await appRequest(app, "GET", "/categories", {
      headers: tenantSlugHeader(fixture.slugB),
    });
    expect(res.status).toBe(200);
    const list = (res.body as { categories?: Array<{ name: string }> }).categories ?? [];
    expect(list.some((c) => c.name === `IsoCat ${suffix}`)).toBe(true);
    const resA = await appRequest(app, "GET", "/categories", {
      headers: tenantSlugHeader(fixture.slugA),
    });
    const listA = (resA.body as { categories?: Array<{ name: string }> }).categories ?? [];
    expect(listA.some((c) => c.name === `IsoCat ${suffix}`)).toBe(false);
  });
});
