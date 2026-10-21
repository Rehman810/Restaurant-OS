import { describe, expect, it, afterAll } from "vitest";
import { CouponDiscountType, Role, TransferStatus } from "@prisma/client";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { appRequest } from "./helpers/app-request";
import { authHeader, createTestUser } from "./helpers/auth";

const hasDb = Boolean(process.env.DATABASE_URL);
const app = createApp();

describe.skipIf(!hasDb)("branch scope — manager across PER_BRANCH surfaces", () => {
  let branchA = "";
  let branchB = "";
  let managerToken = "";
  let managerId = "";
  let couponBId = "";
  let transferId = "";
  let countBId = "";

  afterAll(async () => {
    if (couponBId) await prisma.coupon.deleteMany({ where: { id: couponBId } }).catch(() => {});
    if (transferId) await prisma.stockTransfer.deleteMany({ where: { id: transferId } }).catch(() => {});
    if (countBId) await prisma.stockCount.deleteMany({ where: { id: countBId } }).catch(() => {});
    if (managerId) {
      await prisma.branchMember.deleteMany({ where: { userId: managerId } });
      await prisma.user.delete({ where: { id: managerId } }).catch(() => {});
    }
    if (branchA && branchB) {
      await prisma.branch.deleteMany({ where: { id: { in: [branchA, branchB] } } });
    }
  });

  it("blocks cross-branch header, coupons, inventory counts, and transfers", async () => {
    const restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) return;

    const ts = Date.now();
    const a = await prisma.branch.create({
      data: { restaurantId: restaurant.id, name: "Ext A", code: `EXA${String(ts).slice(-3)}`, isActive: true },
    });
    const b = await prisma.branch.create({
      data: { restaurantId: restaurant.id, name: "Ext B", code: `EXB${String(ts).slice(-3)}`, isActive: true },
    });
    branchA = a.id;
    branchB = b.id;

    const manager = await createTestUser({
      email: `mgr-ext-${ts}@test.local`,
      role: Role.MANAGER,
    });
    managerId = manager.user.id;
    managerToken = manager.token;
    await prisma.branchMember.create({ data: { branchId: branchA, userId: managerId } });

    const forbiddenHeader = await appRequest(app, "GET", "/admin/shifts", {
      headers: { ...authHeader(managerToken), "X-Branch-Id": branchB },
    });
    expect(forbiddenHeader.status).toBe(403);

    const couponB = await prisma.coupon.create({
      data: {
        code: `BRB${ts}`,
        type: CouponDiscountType.PERCENT,
        value: 10,
        branchId: branchB,
        isActive: true,
      },
    });
    couponBId = couponB.id;

    const patchCoupon = await appRequest(app, "PATCH", `/admin/coupons/${couponBId}`, {
      headers: { ...authHeader(managerToken), "X-Branch-Id": branchA },
      body: { isActive: false },
    });
    expect(patchCoupon.status).toBe(403);

    const countB = await prisma.stockCount.create({
      data: { branchId: branchB, countedById: managerId },
    });
    countBId = countB.id;

    const readCount = await appRequest(app, "GET", `/admin/inventory/counts/${countBId}`, {
      headers: { ...authHeader(managerToken), "X-Branch-Id": branchA },
    });
    expect(readCount.status).toBe(403);

    const item = await prisma.inventoryItem.findFirst({ where: { isActive: true } });
    if (item) {
      const transfer = await prisma.stockTransfer.create({
        data: {
          fromBranchId: branchB,
          toBranchId: branchA,
          createdById: managerId,
          status: TransferStatus.PENDING,
          lines: { create: [{ itemId: item.id, quantitySent: 1 }] },
        },
      });
      transferId = transfer.id;

      const ship = await appRequest(app, "POST", `/admin/inventory/transfers/${transferId}/ship`, {
        headers: { ...authHeader(managerToken), "X-Branch-Id": branchA },
      });
      expect(ship.status).toBe(403);
    }

    const branches = await appRequest(app, "GET", "/admin/branches", {
      headers: authHeader(managerToken),
    });
    expect(branches.status).toBe(200);
    const list = (branches.body as { branches: { id: string }[] }).branches;
    expect(list.some((x) => x.id === branchB)).toBe(false);
    expect(list.some((x) => x.id === branchA)).toBe(true);
  });
});
