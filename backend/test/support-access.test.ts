import bcrypt from "bcryptjs";
import { describe, expect, it, beforeAll } from "vitest";
import { PlatformRole, TenantStatus } from "@prisma/client";
import { createApp } from "../src/app";
import { appRequest } from "./helpers/app-request";
import { basePrisma } from "../src/lib/prisma-base";
import { signPlatformToken } from "../src/middleware/platform-auth";
import { DEFAULT_RESTAURANT_ID } from "../src/lib/restaurant-context";
import {
  createTenantSupportSession,
  exchangeSupportAccessToken,
  revokeTenantSupportSession,
} from "../src/lib/platform/support-access";

const hasDb = Boolean(process.env.DATABASE_URL?.includes("test"));
const app = createApp();

describe.skipIf(!hasDb)("support access", () => {
  let platformUserId = "";
  let supportToken = "";

  beforeAll(async () => {
    const hash = await bcrypt.hash("support-test-pass-12", 10);
    const user = await basePrisma.platformUser.create({
      data: {
        email: `support-${Date.now()}@test.local`,
        name: "Support",
        passwordHash: hash,
        role: PlatformRole.SUPPORT,
      },
    });
    platformUserId = user.id;
    supportToken = signPlatformToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tv: 0,
    });
  });

  it("exchanges one-time token for bearer JWT and allows admin read on suspended tenant", async () => {
    await basePrisma.restaurant.update({
      where: { id: DEFAULT_RESTAURANT_ID },
      data: { status: TenantStatus.SUSPENDED, statusReason: "Support test" },
    });

    const session = await createTenantSupportSession({
      subjectRestaurantId: DEFAULT_RESTAURANT_ID,
      platformUserId,
      platformEmail: "support@test.local",
      ttlHours: 1,
    });
    const exchanged = await exchangeSupportAccessToken(session.token);
    expect(exchanged.restaurantId).toBe(DEFAULT_RESTAURANT_ID);

    const exchangeRes = await appRequest(app, "POST", "/auth/support-exchange", {
      body: { token: session.token },
    });
    expect(exchangeRes.status).toBe(200);
    const accessToken = (exchangeRes.body as { token: string }).token;

    const onboardingRes = await appRequest(app, "GET", "/admin/onboarding", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(onboardingRes.status).toBe(200);

    await revokeTenantSupportSession(session.sessionId);
    await basePrisma.restaurant.update({
      where: { id: DEFAULT_RESTAURANT_ID },
      data: { status: TenantStatus.ACTIVE, statusReason: "" },
    });
  });

  it("creates support session via platform API", async () => {
    const res = await appRequest(app, "POST", `/platform/tenants/${DEFAULT_RESTAURANT_ID}/support-sessions`, {
      headers: { Authorization: `Bearer ${supportToken}` },
      body: { ttlHours: 2 },
    });
    expect(res.status).toBe(201);
    expect((res.body as { token?: string }).token).toBeTruthy();
  });
});
