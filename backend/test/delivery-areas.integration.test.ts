import { describe, expect, it, afterAll } from "vitest";
import { Role } from "@prisma/client";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { appRequest } from "./helpers/app-request";
import { authHeader, createTestUser } from "./helpers/auth";
import { computeDeliveryFee } from "../src/lib/delivery/fee";
import { getStoreSettings } from "../src/lib/settings-data";
import { isPauseExpired, resolvePauseUntil } from "../src/lib/delivery/pause";

const hasDb = Boolean(process.env.DATABASE_URL);
const app = createApp();

describe("delivery pause helpers", () => {
  it("auto-expires pause after until", () => {
    const past = new Date(Date.now() - 60_000);
    expect(isPauseExpired({ until: past, resumedAt: null })).toBe(true);
  });

  it("resolves end of store day in timezone", () => {
    const until = resolvePauseUntil({ kind: "end_of_store_day" }, "Asia/Karachi");
    expect(until).toBeInstanceOf(Date);
  });
});

describe.skipIf(!hasDb)("delivery areas API", () => {
  const ts = Date.now();
  let adminToken = "";
  let areaId = "";

  afterAll(async () => {
    if (areaId) {
      await prisma.order.deleteMany({ where: { deliveryAreaId: areaId } });
      await prisma.deliveryAreaBranch.deleteMany({ where: { areaId } });
      await prisma.deliveryArea.deleteMany({ where: { id: areaId } });
    }
    await prisma.user.deleteMany({ where: { email: { contains: `darea-${ts}` } } });
  });

  it("creates area, enforces rename uniqueness, archives referenced area", async () => {
    const admin = await createTestUser({
      email: `darea-admin-${ts}@test.local`,
      role: Role.ADMIN,
    });
    adminToken = admin.token;

    const created = await appRequest(app, "POST", "/admin/areas", {
      headers: authHeader(adminToken),
      body: { name: `Test Zone ${ts}`, charge: 120, isDelivering: true },
    });
    expect(created.status).toBe(201);
    areaId = (created.body as { id: string }).id;

    const dup = await appRequest(app, "POST", "/admin/areas", {
      headers: authHeader(adminToken),
      body: { name: `Test Zone ${ts}`, charge: 100 },
    });
    expect(dup.status).toBe(409);

    const branchId = await prisma.branch
      .findFirst({ where: { isActive: true }, select: { id: true } })
      .then((b) => b!.id);
    const menuItemId = await prisma.menuItem.findFirst({ select: { id: true } }).then((m) => m!.id);
    await prisma.order.create({
      data: {
        orderNumber: `DAREA-${ts}`,
        branchId,
        fulfillmentType: "DELIVERY",
        deliveryAreaId: areaId,
        deliveryAreaNameSnap: `Test Zone ${ts}`,
        subtotal: 600,
        deliveryCharge: 120,
        total: 720,
        customerName: "T",
        customerPhone: "03001234567",
        deliveryAddress: "House 1",
        items: {
          create: { menuItemId, quantity: 1, priceAtOrder: 600, nameAtOrder: "Item" },
        },
      },
    });

    const del = await appRequest(app, "DELETE", `/admin/areas/${areaId}`, {
      headers: authHeader(adminToken),
    });
    expect(del.status).toBe(409);

    const arch = await appRequest(app, "POST", `/admin/areas/${areaId}/archive`, {
      headers: authHeader(adminToken),
    });
    expect(arch.status).toBe(200);

    const settings = await getStoreSettings();
    const fee = computeDeliveryFee(
      { deliveryCharge: 120, minOrder: 600, freeAbove: null },
      500,
      settings
    );
    expect(fee.minOrderMet).toBe(false);
  });

  it("public list excludes archived areas", async () => {
    const pub = await appRequest(app, "GET", "/delivery-areas");
    expect(pub.status).toBe(200);
    const body = pub.body as { areas: { id: string }[] };
    expect(body.areas.some((a) => a.id === areaId)).toBe(false);
  });
});
