import { describe, expect, it, afterAll } from "vitest";
import { FulfillmentType, OrderStatus, Role } from "@prisma/client";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { appRequest } from "./helpers/app-request";
import { authHeader, createTestUser } from "./helpers/auth";

const hasDb = Boolean(process.env.DATABASE_URL);
const app = createApp();

describe.skipIf(!hasDb)("admin orders API", () => {
  const ts = Date.now();
  let managerToken = "";
  let chefToken = "";
  let deliveryId = "";
  let dineInId = "";
  let branchId = "";

  afterAll(async () => {
    await prisma.orderEvent.deleteMany({
      where: { orderId: { in: [deliveryId, dineInId].filter(Boolean) } },
    });
    await prisma.order.deleteMany({
      where: { id: { in: [deliveryId, dineInId].filter(Boolean) } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: `adm-ord-${ts}` } },
    });
  });

  it("lists orders with summary and rejects invalid transition", async () => {
    branchId = await prisma.branch.findFirst({ where: { isActive: true }, select: { id: true } }).then((b) => b!.id);

    const manager = await createTestUser({
      email: `adm-ord-mgr-${ts}@test.local`,
      role: Role.MANAGER,
    });
    managerToken = manager.token;
    await prisma.branchMember.create({ data: { branchId, userId: manager.user.id } });

    const chef = await createTestUser({
      email: `adm-ord-chef-${ts}@test.local`,
      role: Role.CHEF,
    });
    chefToken = chef.token;
    await prisma.branchMember.create({ data: { branchId, userId: chef.user.id } });

    const delivery = await prisma.order.create({
      data: {
        orderNumber: `ADM-D-${ts}`,
        branchId,
        status: OrderStatus.CONFIRMED,
        fulfillmentType: FulfillmentType.DELIVERY,
        subtotal: 500,
        total: 500,
        paymentStatus: "UNPAID",
        customerName: "Test",
        customerPhone: "03009998877",
        deliveryAddress: "Karachi",
        items: {
          create: {
            menuItemId: (await prisma.menuItem.findFirst({ select: { id: true } }))!.id,
            quantity: 1,
            priceAtOrder: 500,
            nameAtOrder: "Burger",
          },
        },
      },
    });
    deliveryId = delivery.id;

    const dineIn = await prisma.order.create({
      data: {
        orderNumber: `ADM-DI-${ts}`,
        branchId,
        status: OrderStatus.CONFIRMED,
        fulfillmentType: FulfillmentType.DINE_IN,
        subtotal: 300,
        total: 300,
        customerName: "Dine",
        customerPhone: "03001112233",
        deliveryAddress: "Table service",
      },
    });
    dineInId = dineIn.id;

    const list = await appRequest(app, "GET", `/admin/orders?from=2020-01-01&to=2030-12-31&q=ADM-D-${ts}`, {
      headers: { ...authHeader(managerToken), "X-Branch-Id": branchId },
    });
    expect(list.status).toBe(200);
    const body = list.body as {
      rows: { id: string; payment: { status: string } | null; nextActions: unknown[] }[];
      summary: { active: number; bookedDefinition: string };
    };
    expect(body.summary.bookedDefinition).toContain("non-cancelled");
    const row = body.rows.find((r) => r.id === deliveryId);
    expect(row?.payment?.status).toBe("cod");

    const bad = await appRequest(
      app,
      "POST",
      `/admin/orders/${dineInId}/transition`,
      {
        headers: { ...authHeader(managerToken), "X-Branch-Id": branchId },
        body: { targetStatus: OrderStatus.OUT_FOR_DELIVERY },
      }
    );
    expect(bad.status).toBe(400);

    const assignRiderBad = await appRequest(
      app,
      "POST",
      `/admin/orders/${dineInId}/assign-rider`,
      {
        headers: { ...authHeader(managerToken), "X-Branch-Id": branchId },
        body: { riderId: manager.user.id },
      }
    );
    expect(assignRiderBad.status).toBe(400);

    const detailChef = await appRequest(app, "GET", `/admin/orders/${deliveryId}`, {
      headers: { ...authHeader(chefToken), "X-Branch-Id": branchId },
    });
    const detailBody = detailChef.body as { payment: unknown; location: unknown; customer: { phone: string } };
    expect(detailBody.payment).toBeNull();
    expect(detailBody.location).toBeNull();
    expect(detailBody.customer.phone).toContain("*");

    const board = await appRequest(app, "GET", "/admin/tracking/board", {
      headers: { ...authHeader(managerToken), "X-Branch-Id": branchId },
    });
    expect(board.status).toBe(200);
    const boardBody = board.body as {
      columns: { id: string; count: number; cards: { id: string }[] }[];
      summary: { active: number; pipelineValue: number };
    };
    const confirmed = boardBody.columns.find((c) => c.id === "CONFIRMED");
    expect(confirmed?.cards.some((c) => c.id === deliveryId)).toBe(true);
    const outCol = boardBody.columns.find((c) => c.id === "OUT_FOR_DELIVERY");
    expect(outCol?.cards.some((c) => c.id === dineInId)).toBe(false);
    expect(boardBody.summary.active).toBeGreaterThanOrEqual(2);

    const riders = await appRequest(app, "GET", "/admin/tracking/riders", {
      headers: { ...authHeader(managerToken), "X-Branch-Id": branchId },
    });
    expect(riders.status).toBe(200);
    const ridersBody = riders.body as { riders: { name: string; location: { locationAvailable: boolean } }[] };
    expect(Array.isArray(ridersBody.riders)).toBe(true);
    if (ridersBody.riders[0]) {
      expect(ridersBody.riders[0].location.locationAvailable).toBe(false);
    }
  });
});
