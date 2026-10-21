import { describe, expect, it, afterAll } from "vitest";
import { Role } from "@prisma/client";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { appRequest } from "./helpers/app-request";
import { authHeader, createTestUser } from "./helpers/auth";
import { validateBranchCode, normalizeBranchCodeInput } from "../src/lib/branches/code";
import { buildDeactivationCheck } from "../src/lib/branches/deactivation";

const hasDb = Boolean(process.env.DATABASE_URL);
const app = createApp();

describe("branch code helpers", () => {
  it("accepts valid codes", () => {
    expect(validateBranchCode("MAIN")).toBeNull();
    expect(normalizeBranchCodeInput("ab-12")).toBe("AB12");
  });
  it("rejects invalid codes", () => {
    expect(validateBranchCode("A")).not.toBeNull();
    expect(validateBranchCode("toolong1")).not.toBeNull();
  });
});

describe.skipIf(!hasDb)("admin branches API", () => {
  const createdBranchIds: string[] = [];
  let adminToken = "";
  let adminId = "";
  let managerToken = "";
  let managerId = "";

  afterAll(async () => {
    if (managerId) {
      await prisma.branchMember.deleteMany({ where: { userId: managerId } });
      await prisma.user.delete({ where: { id: managerId } }).catch(() => {});
    }
    if (adminId) {
      await prisma.user.delete({ where: { id: adminId } }).catch(() => {});
    }
    if (createdBranchIds.length) {
      await prisma.branch.deleteMany({ where: { id: { in: createdBranchIds } } });
    }
  });

  it("setup admin and manager", async () => {
    const admin = await createTestUser({ email: `adm-br-${Date.now()}@test.local`, role: Role.ADMIN });
    adminId = admin.user.id;
    adminToken = admin.token;
    const restaurant = await prisma.restaurant.findFirst();
    expect(restaurant).toBeTruthy();
  });

  it("blocks deactivating default branch", async () => {
    const def = await prisma.branch.findFirst({ where: { isDefault: true, isActive: true } });
    expect(def).toBeTruthy();
    const res = await appRequest(app, "GET", `/admin/branches/${def!.id}/deactivation-check`, {
      headers: authHeader(adminToken),
    });
    expect(res.status).toBe(200);
    const body = res.body as { canDeactivate: boolean; blockers: { code: string }[] };
    expect(body.canDeactivate).toBe(false);
    expect(body.blockers.some((b) => b.code === "DEFAULT_BRANCH")).toBe(true);
  });

  it("manager cannot list all branches", async () => {
    const ts = Date.now();
    const a = await prisma.branch.create({
      data: { name: "Mgr A", code: `MRA${String(ts).slice(-4)}`, isActive: true },
    });
    const b = await prisma.branch.create({
      data: { name: "Mgr B", code: `MRB${String(ts).slice(-4)}`, isActive: true },
    });
    createdBranchIds.push(a.id, b.id);

    const manager = await createTestUser({
      email: `mgr-br-${ts}@test.local`,
      role: Role.MANAGER,
    });
    managerId = manager.user.id;
    managerToken = manager.token;
    await prisma.branchMember.create({ data: { branchId: a.id, userId: managerId } });

    const res = await appRequest(app, "GET", "/admin/branches", {
      headers: authHeader(managerToken),
    });
    expect(res.status).toBe(200);
    const body = res.body as { branches: { id: string }[] };
    expect(body.branches).toHaveLength(1);
    expect(body.branches[0].id).toBe(a.id);
  });

  it("online ordering toggle is audited", async () => {
    const branch = await prisma.branch.findFirst({ where: { isActive: true, isDefault: false } });
    if (!branch) return;
    const res = await appRequest(app, "PATCH", `/admin/branches/${branch.id}/online-ordering`, {
      headers: authHeader(adminToken),
      body: { enabled: false, reason: "Kitchen maintenance" },
    });
    expect(res.status).toBe(200);
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: branch.id, entityType: "branch" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit?.reason).toContain("Kitchen");
    await appRequest(app, "PATCH", `/admin/branches/${branch.id}/online-ordering`, {
      headers: authHeader(adminToken),
      body: { enabled: true, reason: "Reopen" },
    });
  });
});

describe.skipIf(!hasDb)("deactivation check last active", () => {
  it("reports LAST_ACTIVE when only one active branch", async () => {
    const active = await prisma.branch.findMany({ where: { isActive: true } });
    if (active.length !== 1) return;
    const check = await buildDeactivationCheck(active[0].id);
    expect(check.blockers.some((b) => b.code === "LAST_ACTIVE_BRANCH" || b.code === "DEFAULT_BRANCH")).toBe(
      true
    );
  });
});
