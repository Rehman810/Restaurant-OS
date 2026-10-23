import bcrypt from "bcryptjs";
import { describe, expect, it, beforeAll } from "vitest";
import { PlatformRole } from "@prisma/client";
import { createApp } from "../src/app";
import { appRequest } from "./helpers/app-request";
import { basePrisma } from "../src/lib/prisma-base";
import { signPlatformToken } from "../src/middleware/platform-auth";
import { mergeEntitlements } from "../src/lib/platform/effective-entitlements";

const hasDb = Boolean(process.env.DATABASE_URL?.includes("test"));
const app = createApp();

describe("platform phase 3 entitlements", () => {
  it("merges plan version and tenant overrides", () => {
    const merged = mergeEntitlements(
      { maxBranches: 2, maxStaff: 10 },
      { maxBranches: 3 },
      { maxStaff: 15 }
    );
    expect(merged.maxBranches).toBe(3);
    expect(merged.maxStaff).toBe(15);
  });
});

describe.skipIf(!hasDb)("platform phase 3 api", () => {
  let superToken = "";
  const password = "platform-test-pass-12";

  beforeAll(async () => {
    const email = `super-p3-${Date.now()}@test.local`;
    const hash = await bcrypt.hash(password, 10);
    const superUser = await basePrisma.platformUser.create({
      data: {
        email,
        name: "Super P3",
        passwordHash: hash,
        role: PlatformRole.SUPER_ADMIN,
      },
    });
    superToken = signPlatformToken({
      id: superUser.id,
      email: superUser.email,
      name: superUser.name,
      role: superUser.role,
      tv: 0,
    });
  });

  it("creates a feature flag and writes audit", async () => {
    const key = `phase3_flag_${Date.now()}`;
    const res = await appRequest(app, "POST", "/platform/feature-flags", {
      headers: { Authorization: `Bearer ${superToken}` },
      body: { key, description: "Phase 3 test flag", defaultEnabled: false },
    });
    expect(res.status).toBe(201);
    const body = res.body as { flag: { id: string; key: string } };
    expect(body.flag.key).toBe(key);
    const audit = await basePrisma.platformAuditLog.findFirst({
      where: { action: "feature_flag.created", entityId: body.flag.id },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toBeTruthy();
  });

  it("exposes public status without auth", async () => {
    const res = await appRequest(app, "GET", "/platform/status/public");
    expect(res.status).toBe(200);
    const body = res.body as { statusPage?: { headline?: string } };
    expect(body.statusPage?.headline).toBeTruthy();
  });
});
