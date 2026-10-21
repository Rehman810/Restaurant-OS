import { describe, expect, it, afterAll } from "vitest";
import { Role } from "@prisma/client";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { appRequest } from "./helpers/app-request";
import { authHeader, createTestUser } from "./helpers/auth";
const hasDb = Boolean(process.env.DATABASE_URL);
const app = createApp();

describe.skipIf(!hasDb)("staff API privileges", () => {
  const ts = Date.now();
  let ownerToken = "";
  let adminToken = "";
  let managerToken = "";
  let targetManagerId = "";

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            `staff-own-${ts}@test.local`,
            `staff-noadm-${ts}@test.local`,
            `staff-mgr-t-${ts}@test.local`,
          ],
        },
      },
    });
  });

  it("owner can list staff; manager can list; cashier cannot", async () => {
    const ownerLogin = await createTestUser({
      email: `staff-own-${ts}@test.local`,
      role: Role.ADMIN,
    });
    await prisma.user.update({ where: { id: ownerLogin.user.id }, data: { isOwner: true } });
    ownerToken = ownerLogin.token;

    const plainAdmin = await createTestUser({
      email: `staff-noadm-${ts}@test.local`,
      role: Role.ADMIN,
    });
    adminToken = plainAdmin.token;

    const mgr = await createTestUser({
      email: `staff-mgr-t-${ts}@test.local`,
      role: Role.MANAGER,
    });
    targetManagerId = mgr.user.id;
    managerToken = mgr.token;
    const branch = await prisma.branch.findFirst({ where: { isActive: true } });
    if (branch) {
      await prisma.branchMember.create({ data: { userId: mgr.user.id, branchId: branch.id } });
    }

    const ownerList = await appRequest(app, "GET", "/admin/staff/", {
      headers: { ...authHeader(ownerToken), "X-Branch-Id": "all" },
    });
    expect(ownerList.status).toBe(200);

    const mgrList = await appRequest(app, "GET", "/admin/staff/", {
      headers: authHeader(managerToken),
    });
    expect(mgrList.status).toBe(200);

    const cashier = await createTestUser({
      email: `staff-cash-${ts}@test.local`,
      role: Role.CASHIER,
    });
    const cashierList = await appRequest(app, "GET", "/admin/staff/", {
      headers: authHeader(cashier.token),
    });
    expect(cashierList.status).toBe(403);
    await prisma.user.delete({ where: { id: cashier.user.id } });
  });

  it("non-owner admin cannot create admin", async () => {
    const res = await appRequest(app, "POST", "/admin/staff/", {
      headers: { ...authHeader(adminToken), "X-Branch-Id": "all" },
      body: {
        name: "New Admin",
        email: `new-adm-${ts}@test.local`,
        role: Role.ADMIN,
        sendInvite: true,
      },
    });
    expect(res.status).toBe(403);
  });

  it("manager cannot edit a non-owner admin", async () => {
    const plainAdmin = await prisma.user.findFirst({
      where: { email: `staff-noadm-${ts}@test.local` },
    });
    expect(plainAdmin).toBeTruthy();
    const res = await appRequest(app, "PATCH", `/admin/staff/${plainAdmin!.id}`, {
      headers: authHeader(managerToken),
      body: { name: "Blocked rename" },
    });
    expect(res.status).toBe(403);
  });

  it("hides test users by default", async () => {
    const res = await appRequest(app, "GET", "/admin/staff/?includeTest=true", {
      headers: { ...authHeader(ownerToken), "X-Branch-Id": "all" },
    });
    expect(res.status).toBe(200);
    const body = res.body as { staff: { email: string }[] };
    expect(body.staff.some((s) => s.email.endsWith("@test.local"))).toBe(true);

    const hidden = await appRequest(app, "GET", "/admin/staff/", {
      headers: { ...authHeader(ownerToken), "X-Branch-Id": "all" },
    });
    const hiddenBody = hidden.body as { staff: { email: string }[] };
    expect(hiddenBody.staff.some((s) => s.email.endsWith("@test.local"))).toBe(false);
  });
});
