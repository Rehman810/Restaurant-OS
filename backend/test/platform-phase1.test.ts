import bcrypt from "bcryptjs";
import { describe, expect, it, beforeAll } from "vitest";
import { PlatformInvoiceStatus, PlatformPaymentMethod, PlatformRole } from "@prisma/client";
import { createApp } from "../src/app";
import { appRequest } from "./helpers/app-request";
import { basePrisma } from "../src/lib/prisma-base";
import { signPlatformToken } from "../src/middleware/platform-auth";
import { DEFAULT_RESTAURANT_ID } from "../src/lib/restaurant-context";
import { loadPlatformOverview } from "../src/lib/platform/overview";
import { assertCanDemoteOrDeactivateSuperAdmin } from "../src/lib/platform/platform-users-guard";
import { generateSecret } from "../src/lib/totp";
import { createRecoveryCodes, matchRecoveryCode } from "../src/lib/recovery-codes";

const hasDb = Boolean(process.env.DATABASE_URL?.includes("test"));
const app = createApp();

describe.skipIf(!hasDb)("platform phase 1", () => {
  let superToken = "";
  let superId = "";
  const superEmail = `super-p1-${Date.now()}@test.local`;
  const password = "platform-test-pass-12";

  beforeAll(async () => {
    const hash = await bcrypt.hash(password, 10);
    const superUser = await basePrisma.platformUser.create({
      data: {
        email: superEmail,
        name: "Super P1",
        passwordHash: hash,
        role: PlatformRole.SUPER_ADMIN,
      },
    });
    superId = superUser.id;
    superToken = signPlatformToken({
      id: superUser.id,
      email: superUser.email,
      name: superUser.name,
      role: superUser.role,
      tv: 0,
    });
  });

  it("excludes test tenants from overview MRR", async () => {
    const sub = await basePrisma.subscription.findUnique({
      where: { restaurantId: DEFAULT_RESTAURANT_ID },
      include: { plan: true },
    });
    expect(sub).toBeTruthy();
    await basePrisma.restaurant.update({
      where: { id: DEFAULT_RESTAURANT_ID },
      data: { isTest: true },
    });
    const overviewTest = await loadPlatformOverview();
    const mrrWithTest = overviewTest.mrrPkr;
    await basePrisma.restaurant.update({
      where: { id: DEFAULT_RESTAURANT_ID },
      data: { isTest: false },
    });
    const overviewReal = await loadPlatformOverview();
    expect(overviewReal.mrrPkr).toBeGreaterThanOrEqual(mrrWithTest);
    if (sub && sub.status === "ACTIVE") {
      expect(overviewReal.mrrPkr - mrrWithTest).toBeGreaterThan(0);
    }
  });

  it("blocks demoting the last super admin", async () => {
    const others = await basePrisma.platformUser.count({
      where: { role: PlatformRole.SUPER_ADMIN, isActive: true, id: { not: superId } },
    });
    if (others > 0) return;
    await expect(assertCanDemoteOrDeactivateSuperAdmin(superId, PlatformRole.ADMIN)).rejects.toMatchObject({
      code: "LAST_SUPER_ADMIN",
    });
  });

  it("platform login requires TOTP when enabled", async () => {
    const secret = generateSecret();
    const email = `2fa-${Date.now()}@test.local`;
    const hash = await bcrypt.hash(password, 10);
    const user = await basePrisma.platformUser.create({
      data: {
        email,
        name: "2FA User",
        passwordHash: hash,
        role: PlatformRole.READONLY,
        totpSecret: secret,
        totpEnabled: true,
      },
    });
    const login = await appRequest(app, "POST", "/platform/auth/login", {
      body: { email, password },
    });
    expect(login.status).toBe(200);
    expect((login.body as { requiresTwoFactor?: boolean }).requiresTwoFactor).toBe(true);
    const challenge = (login.body as { challengeToken: string }).challengeToken;
    const bad = await appRequest(app, "POST", "/platform/auth/login/2fa", {
      body: { challengeToken: challenge, code: "000000" },
    });
    expect(bad.status).toBe(401);
    const recovery = createRecoveryCodes(2);
    await basePrisma.platformUser.update({
      where: { id: user.id },
      data: { recoveryCodes: recovery.stored },
    });
    const ok = await appRequest(app, "POST", "/platform/auth/login/2fa", {
      body: { challengeToken: challenge, code: recovery.plain[0] },
    });
    expect(ok.status).toBe(200);
    expect(matchRecoveryCode(recovery.stored, recovery.plain[0]).ok).toBe(true);
  });

  it("approves tenant payment proof and marks invoice paid", async () => {
    const sub = await basePrisma.subscription.findUnique({
      where: { restaurantId: DEFAULT_RESTAURANT_ID },
    });
    expect(sub).toBeTruthy();
    const invoice = await basePrisma.platformInvoice.create({
      data: {
        restaurantId: DEFAULT_RESTAURANT_ID,
        subscriptionId: sub!.id,
        invoiceNumber: `P1-${Date.now()}`,
        status: PlatformInvoiceStatus.OPEN,
        amountPkr: 5000,
        periodStart: new Date("2025-01-01"),
        periodEnd: new Date("2025-02-01"),
        dueAt: new Date("2025-02-15"),
      },
    });
    const proof = await basePrisma.platformPaymentProof.create({
      data: {
        restaurantId: DEFAULT_RESTAURANT_ID,
        invoiceId: invoice.id,
        method: PlatformPaymentMethod.BANK_TRANSFER,
        amountPkr: 5000,
        reference: "REF-P1",
        paidAt: new Date("2025-02-10"),
        submittedBy: "owner@test.local",
      },
    });
    const approve = await appRequest(app, "POST", `/platform/payment-proofs/${proof.id}/approve`, {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    expect(approve.status).toBe(200);
    const paid = await basePrisma.platformInvoice.findUnique({ where: { id: invoice.id } });
    expect(paid?.status).toBe(PlatformInvoiceStatus.PAID);
  });
});
