import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { appRequest } from "./helpers/app-request";
import { createTestUser } from "./helpers/auth";
import { Role } from "@prisma/client";
import { DEFAULT_RESTAURANT_ID, runWithRestaurant } from "../src/lib/restaurant-context";
import { getOnboardingStatus } from "../src/lib/onboarding";

const hasDb = Boolean(process.env.DATABASE_URL?.includes("test"));
const app = createApp();

describe.skipIf(!hasDb)("onboarding", () => {
  it("returns step checklist for admins", async () => {
    const status = await runWithRestaurant(DEFAULT_RESTAURANT_ID, () => getOnboardingStatus());
    expect(status.steps.length).toBe(3);
    expect(typeof status.complete).toBe("boolean");
  });

  it("GET /admin/onboarding requires admin role", async () => {
    const { token } = await createTestUser({ email: `onboard-${Date.now()}@test.local`, role: Role.ADMIN });
    const res = await appRequest(app, "GET", "/admin/onboarding", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect((res.body as { steps?: unknown[] }).steps?.length).toBe(3);
  });
});
