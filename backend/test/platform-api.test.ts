import bcrypt from "bcryptjs";
import { describe, expect, it, beforeAll } from "vitest";
import { PlatformRole, Role } from "@prisma/client";
import { createApp } from "../src/app";
import { appRequest } from "./helpers/app-request";
import { basePrisma } from "../src/lib/prisma-base";
import { signPlatformToken } from "../src/middleware/platform-auth";
import { createTestUser } from "./helpers/auth";
import { DEFAULT_RESTAURANT_ID } from "../src/lib/restaurant-context";

const hasDb = Boolean(process.env.DATABASE_URL?.includes("test"));
const app = createApp();

describe.skipIf(!hasDb)("platform API", () => {
  const email = `platform-${Date.now()}@test.local`;
  const password = "platform-test-pass-12";
  let billingUserId = "";
  let billingToken = "";

  beforeAll(async () => {
    const hash = await bcrypt.hash(password, 10);
    const billing = await basePrisma.platformUser.create({
      data: {
        email,
        name: "Billing",
        passwordHash: hash,
        role: PlatformRole.BILLING,
      },
    });
    billingUserId = billing.id;
    billingToken = signPlatformToken({
      id: billing.id,
      email: billing.email,
      name: billing.name,
      role: billing.role,
      tv: 0,
    });
  });

  it("rejects tenant session on platform routes", async () => {
    const { token } = await createTestUser({ email: `tenant-${Date.now()}@test.local`, role: Role.ADMIN });
    const res = await appRequest(app, "GET", "/platform/plans", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
  });

  it("lists plans with a platform token", async () => {
    const res = await appRequest(app, "GET", "/platform/plans", {
      headers: { Authorization: `Bearer ${billingToken}` },
    });
    expect(res.status).toBe(200);
    expect((res.body as { plans?: unknown[] }).plans?.length).toBeGreaterThan(0);
  });

  it("lists tenants", async () => {
    const res = await appRequest(app, "GET", "/platform/tenants", {
      headers: { Authorization: `Bearer ${billingToken}` },
    });
    expect(res.status).toBe(200);
    const tenants = (res.body as { tenants: Array<{ id: string }> }).tenants;
    expect(tenants.some((t) => t.id === DEFAULT_RESTAURANT_ID)).toBe(true);
  });

  it("forbids billing role from changing tenant status", async () => {
    const res = await appRequest(app, "PATCH", `/platform/tenants/${DEFAULT_RESTAURANT_ID}`, {
      headers: { Authorization: `Bearer ${billingToken}` },
      body: { statusReason: "probe" },
    });
    expect(res.status).toBe(403);
  });

  it("logs in with email and password", async () => {
    const res = await appRequest(app, "POST", "/platform/auth/login", {
      body: { email, password },
    });
    expect(res.status).toBe(200);
    expect((res.body as { user?: { id: string } }).user?.id).toBe(billingUserId);
  });

  it("platform login succeeds when a tenant session cookie is also present", async () => {
    const tenant = await createTestUser({ email: `tenant-cookie-${Date.now()}@test.local`, role: Role.ADMIN });
    const tenantCookie = `ros_session=${encodeURIComponent(tenant.token)}`;
    const res = await appRequest(app, "POST", "/platform/auth/login", {
      headers: { Cookie: tenantCookie },
      body: { email, password },
    });
    expect(res.status).toBe(200);
    await basePrisma.user.delete({ where: { id: tenant.user.id } }).catch(() => null);
  });
});
