import { describe, expect, it, afterAll } from "vitest";
import { FulfillmentType, OrderStatus, Role } from "@prisma/client";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { signOrderViewToken } from "../src/lib/order-access";
import { appRequest } from "./helpers/app-request";
import { authHeader, createTestUser } from "./helpers/auth";

const hasDb = Boolean(process.env.DATABASE_URL);
const app = createApp();

describe.skipIf(!hasDb)("IDOR — orders and staff surfaces", () => {
  const ids: string[] = [];

  afterAll(async () => {
    if (ids.length) {
      await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } });
      await prisma.order.deleteMany({ where: { id: { in: ids } } });
    }
  });

  it("customer A cannot read customer B order", async () => {
    const a = await createTestUser({ email: `cust-a-${Date.now()}@test.local`, role: Role.CUSTOMER });
    const b = await createTestUser({ email: `cust-b-${Date.now()}@test.local`, role: Role.CUSTOMER });
    const branch = await prisma.branch.findFirst({ where: { isActive: true } });
    if (!branch) return;

    const orderB = await prisma.order.create({
      data: {
        orderNumber: `T-${Date.now()}`,
        customerId: b.user.id,
        branchId: branch.id,
        status: OrderStatus.CONFIRMED,
        fulfillmentType: FulfillmentType.PICKUP,
        subtotal: 100,
        total: 100,
        customerName: "B",
        customerPhone: "03001234567",
        deliveryAddress: "Pickup",
      },
    });
    ids.push(orderB.id);

    const res = await appRequest(app, "GET", `/orders/${orderB.id}`, {
      headers: authHeader(a.token),
    });
    expect(res.status).toBe(403);
  });

  it("guest view token only works for its order", async () => {
    const branch = await prisma.branch.findFirst({ where: { isActive: true } });
    if (!branch) return;

    const orderA = await prisma.order.create({
      data: {
        orderNumber: `G-${Date.now()}-A`,
        branchId: branch.id,
        status: OrderStatus.CONFIRMED,
        fulfillmentType: FulfillmentType.PICKUP,
        subtotal: 50,
        total: 50,
        customerName: "Guest",
        customerPhone: "03009998877",
        guestAccessToken: "guest-token-a",
        deliveryAddress: "Pickup",
      },
    });
    const orderB = await prisma.order.create({
      data: {
        orderNumber: `G-${Date.now()}-B`,
        branchId: branch.id,
        status: OrderStatus.CONFIRMED,
        fulfillmentType: FulfillmentType.PICKUP,
        subtotal: 50,
        total: 50,
        customerName: "Guest",
        customerPhone: "03009998876",
        guestAccessToken: "guest-token-b",
        deliveryAddress: "Pickup",
      },
    });
    ids.push(orderA.id, orderB.id);

    const ok = await appRequest(app, "GET", `/orders/${orderA.id}?token=guest-token-a`);
    expect(ok.status).toBe(200);

    const bad = await appRequest(app, "GET", `/orders/${orderB.id}?token=guest-token-a`);
    expect(bad.status).toBe(403);

    const jwtWrong = await appRequest(
      app,
      "GET",
      `/orders/${orderB.id}?token=${signOrderViewToken(orderA.id)}`
    );
    expect(jwtWrong.status).toBe(403);
  });

  it("chef without branch membership cannot read another branch order", async () => {
    const restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) return;

    const branchA = await prisma.branch.create({
      data: {
        restaurantId: restaurant.id,
        name: "Branch A IDOR",
        code: `a-${Date.now()}`,
        isActive: true,
      },
    });
    const branchB = await prisma.branch.create({
      data: {
        restaurantId: restaurant.id,
        name: "Branch B IDOR",
        code: `b-${Date.now()}`,
        isActive: true,
      },
    });

    const chef = await createTestUser({
      email: `chef-scope-${Date.now()}@test.local`,
      role: Role.CHEF,
    });
    await prisma.branchMember.create({ data: { branchId: branchA.id, userId: chef.user.id } });

    const orderB = await prisma.order.create({
      data: {
        orderNumber: `C-${Date.now()}`,
        branchId: branchB.id,
        status: OrderStatus.CONFIRMED,
        fulfillmentType: FulfillmentType.PICKUP,
        subtotal: 80,
        total: 80,
        customerName: "X",
        customerPhone: "03001112222",
        deliveryAddress: "Pickup",
      },
    });
    ids.push(orderB.id);

    const res = await appRequest(app, "GET", `/orders/${orderB.id}`, {
      headers: authHeader(chef.token),
    });
    expect(res.status).toBe(403);

    await prisma.branchMember.deleteMany({ where: { userId: chef.user.id } });
    await prisma.user.delete({ where: { id: chef.user.id } });
    await prisma.branch.deleteMany({ where: { id: { in: [branchA.id, branchB.id] } } });
  });

  it("cashier cannot reach admin audit logs", async () => {
    const cashier = await createTestUser({
      email: `cashier-idor-${Date.now()}@test.local`,
      role: Role.CASHIER,
    });
    const res = await appRequest(app, "GET", "/admin/audit-logs/", {
      headers: authHeader(cashier.token),
    });
    expect(res.status).toBe(403);
    await prisma.user.delete({ where: { id: cashier.user.id } });
  });
});
