import { describe, expect, it, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { DEMO_ADMIN_EMAIL } from "../src/lib/test-users";
import { planTestStaffCleanup, applyTestStaffCleanup } from "../src/lib/test-staff/cleanup";
import { createTestUser } from "./helpers/auth";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("test staff cleanup", () => {
  const ts = Date.now();
  let disposableId = "";
  let withAuditId = "";

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: `cleanup-del-${ts}@test.local` } }).catch(() => {});
    await prisma.user
      .update({
        where: { email: `cleanup-deact-${ts}@test.local` },
        data: { isActive: false },
      })
      .catch(() => {});
  });

  it("dry-run plan does not change rows", async () => {
    const before = await prisma.user.count({ where: { email: { endsWith: "@test.local" } } });
    await planTestStaffCleanup();
    const after = await prisma.user.count({ where: { email: { endsWith: "@test.local" } } });
    expect(after).toBe(before);
  });

  it("apply deletes history-free users and deactivates users with audit history", async () => {
    const del = await createTestUser({
      email: `cleanup-del-${ts}@test.local`,
      role: Role.CHEF,
    });
    disposableId = del.user.id;

    const deact = await createTestUser({
      email: `cleanup-deact-${ts}@test.local`,
      role: Role.MANAGER,
    });
    withAuditId = deact.user.id;
    await prisma.auditLog.create({
      data: {
        actorId: deact.user.id,
        actorRole: Role.MANAGER,
        action: "LOGIN_SUCCESS",
        entityType: "user",
        entityId: deact.user.id,
      },
    });

    const plan = await planTestStaffCleanup();
    const delAction = plan.actions.find((a) => a.email === `cleanup-del-${ts}@test.local`);
    const deactAction = plan.actions.find((a) => a.email === `cleanup-deact-${ts}@test.local`);
    expect(delAction?.kind).toBe("delete");
    expect(deactAction?.kind).toBe("deactivate");

    await applyTestStaffCleanup({
      actions: (delAction && deactAction ? [delAction, deactAction] : []) as typeof plan.actions,
    });

    const gone = await prisma.user.findUnique({ where: { id: disposableId } });
    expect(gone).toBeNull();

    const still = await prisma.user.findUnique({ where: { id: withAuditId } });
    expect(still?.isActive).toBe(false);
  });

  it("never plans delete for demo admin", async () => {
    const plan = await planTestStaffCleanup();
    const demo = plan.actions.find((a) => a.email === DEMO_ADMIN_EMAIL);
    expect(demo).toBeUndefined();
  });
});

describe.skipIf(!hasDb)("production login block for test users", () => {
  const prevEnv = process.env.NODE_ENV;

  afterAll(() => {
    process.env.NODE_ENV = prevEnv;
  });

  it("rejects test user login when NODE_ENV=production", async () => {
    const email = `login-block-${Date.now()}@test.local`;
    const { user, password } = await createTestUser({ email, role: Role.MANAGER });
    const { createApp } = await import("../src/app");
    const { appRequest } = await import("./helpers/app-request");
    const app = createApp();

    process.env.NODE_ENV = "production";
    const res = await appRequest(app, "POST", "/auth/login", {
      body: { email, password },
    });
    expect(res.status).toBe(401);
  });
});
