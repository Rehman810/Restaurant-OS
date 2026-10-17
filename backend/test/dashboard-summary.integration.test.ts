import { describe, expect, it, afterAll } from "vitest";
import { FulfillmentType, OrderStatus, Role } from "@prisma/client";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { appRequest } from "./helpers/app-request";
import { authHeader, createTestUser } from "./helpers/auth";
import { ensureDefaultBranch } from "../src/lib/branch-scope";
import { storeTodayUtcRange } from "../src/lib/reports/time-range";
import { getStoreSettings } from "../src/lib/settings-data";

const hasDb = Boolean(process.env.DATABASE_URL);
const app = createApp();

describe.skipIf(!hasDb)("GET /admin/dashboard/summary", () => {
  let adminToken = "";
  let chefToken = "";
  let chefId = "";
  const ts = Date.now();

  afterAll(async () => {
    try {
      await prisma.order.deleteMany({ where: { orderNumber: { startsWith: `DASH-${ts}` } } });
      await prisma.user.deleteMany({
        where: { email: { in: [`chef-dash-${ts}@test.local`, `admin-dash-${ts}@test.local`] } },
      });
    } catch {
      /* DB unavailable */
    }
  });

  it("returns KPIs for admin and hides financials for chef", async () => {
    const settings = await getStoreSettings();
    const tz = settings.timezone || "Asia/Karachi";
    const branchId = await ensureDefaultBranch();
    const { start, end } = storeTodayUtcRange(tz);

    const admin = await createTestUser({ email: `admin-dash-${ts}@test.local`, role: Role.ADMIN });
    adminToken = admin.token;

    const chef = await createTestUser({ email: `chef-dash-${ts}@test.local`, role: Role.CHEF });
    chefId = chef.user.id;
    chefToken = chef.token;

    await prisma.order.create({
      data: {
        orderNumber: `DASH-${ts}-BOOKED`,
        branchId,
        status: OrderStatus.CONFIRMED,
        fulfillmentType: FulfillmentType.PICKUP,
        subtotal: 500,
        total: 500,
        customerName: "Dash Test",
        customerPhone: "03001234567",
        deliveryAddress: "Pickup",
        createdAt: new Date((start.getTime() + end.getTime()) / 2),
      },
    });

    await prisma.order.create({
      data: {
        orderNumber: `DASH-${ts}-DONE`,
        branchId,
        status: OrderStatus.COLLECTED,
        fulfillmentType: FulfillmentType.PICKUP,
        subtotal: 300,
        total: 300,
        customerName: "Done",
        customerPhone: "03001234568",
        deliveryAddress: "Pickup",
        createdAt: new Date((start.getTime() + end.getTime()) / 2),
      },
    });

    const adminRes = await appRequest(app, "GET", `/admin/dashboard/summary?branchId=${branchId}`, {
      headers: authHeader(adminToken),
    });
    expect(adminRes.status).toBe(200);
    const adminBody = adminRes.body as { kpis: { booked: { value: number }; collected: { value: number } }; last7Days: unknown[] };
    expect(adminBody.kpis.booked.value).toBeGreaterThanOrEqual(800);
    expect(adminBody.kpis.collected.value).toBeGreaterThanOrEqual(300);
    expect(adminBody.last7Days).toHaveLength(7);

    const chefRes = await appRequest(app, "GET", `/admin/dashboard/summary?branchId=${branchId}`, {
      headers: authHeader(chefToken),
    });
    expect(chefRes.status).toBe(200);
    const chefBody = chefRes.body as { kpis: { booked: null; sourceSplit: null } };
    expect(chefBody.kpis.booked).toBeNull();
    expect(chefBody.sourceSplit).toBeNull();
  });
});
