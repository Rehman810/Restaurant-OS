import { describe, expect, it, afterAll } from "vitest";
import { FulfillmentType, OrderStatus, Role } from "@prisma/client";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { appRequest } from "./helpers/app-request";
import { authHeader, createTestUser } from "./helpers/auth";

const hasDb = Boolean(process.env.DATABASE_URL);
const app = createApp();

describe.skipIf(!hasDb)("branch scope — manager isolation", () => {
  let branchA = "";
  let branchB = "";
  let managerId = "";
  let managerToken = "";
  let orderBId = "";

  afterAll(async () => {
    if (orderBId) {
      await prisma.order.deleteMany({ where: { id: orderBId } });
    }
    if (managerId) {
      await prisma.branchMember.deleteMany({ where: { userId: managerId } });
      await prisma.user.delete({ where: { id: managerId } });
    }
    if (branchA && branchB) {
      await prisma.branch.deleteMany({ where: { id: { in: [branchA, branchB] } } });
    }
  });

  it("manager of branch A cannot read or update branch B orders", async () => {
    const restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) return;

    const ts = Date.now();
    const a = await prisma.branch.create({
      data: {
        restaurantId: restaurant.id,
        name: "Scope A",
        code: `scope-a-${ts}`,
        isActive: true,
      },
    });
    const b = await prisma.branch.create({
      data: {
        restaurantId: restaurant.id,
        name: "Scope B",
        code: `scope-b-${ts}`,
        isActive: true,
      },
    });
    branchA = a.id;
    branchB = b.id;

    const manager = await createTestUser({
      email: `mgr-scope-${ts}@test.local`,
      role: Role.MANAGER,
    });
    managerId = manager.user.id;
    managerToken = manager.token;
    await prisma.branchMember.create({ data: { branchId: branchA, userId: managerId } });

    const orderB = await prisma.order.create({
      data: {
        orderNumber: `SCOPE-${ts}`,
        branchId: branchB,
        status: OrderStatus.CONFIRMED,
        fulfillmentType: FulfillmentType.PICKUP,
        subtotal: 200,
        total: 200,
        customerName: "Remote",
        customerPhone: "03005556666",
        deliveryAddress: "Pickup",
      },
    });
    orderBId = orderB.id;

    const list = await appRequest(app, "GET", "/orders/?limit=50", {
      headers: { ...authHeader(managerToken), "X-Branch-Id": branchA },
    });
    expect(list.status).toBe(200);
    const orders = (list.body as { orders?: { id: string }[] }).orders || [];
    expect(orders.some((o) => o.id === orderBId)).toBe(false);

    const read = await appRequest(app, "GET", `/orders/${orderBId}`, {
      headers: authHeader(managerToken),
    });
    expect(read.status).toBe(403);

    const patch = await appRequest(app, "PATCH", `/orders/${orderBId}/status`, {
      headers: authHeader(managerToken),
      body: { status: OrderStatus.PREPARING },
    });
    expect(patch.status).toBe(403);
  });
});
