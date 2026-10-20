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

describe.skipIf(!hasDb)("analytics vs dashboard KPI parity (today)", () => {
  const ts = Date.now();
  let adminToken = "";

  afterAll(async () => {
    try {
      await prisma.order.deleteMany({ where: { orderNumber: { startsWith: `PAR-${ts}` } } });
      await prisma.user.deleteMany({ where: { email: `admin-par-${ts}@test.local` } });
    } catch {
      /* DB unavailable */
    }
  });

  it("booked and collected match between dashboard summary and analytics overview", async () => {
    const settings = await getStoreSettings();
    const tz = settings.timezone || "Asia/Karachi";
    const branchId = await ensureDefaultBranch();
    const { start, end } = storeTodayUtcRange(tz);

    const admin = await createTestUser({ email: `admin-par-${ts}@test.local`, role: Role.ADMIN });
    adminToken = admin.token;

    await prisma.order.create({
      data: {
        orderNumber: `PAR-${ts}-B`,
        branchId,
        status: OrderStatus.CONFIRMED,
        fulfillmentType: FulfillmentType.PICKUP,
        subtotal: 400,
        total: 400,
        customerName: "Parity",
        customerPhone: "03009999001",
        deliveryAddress: "Pickup",
        createdAt: new Date((start.getTime() + end.getTime()) / 2),
      },
    });
    await prisma.order.create({
      data: {
        orderNumber: `PAR-${ts}-C`,
        branchId,
        status: OrderStatus.COLLECTED,
        fulfillmentType: FulfillmentType.PICKUP,
        subtotal: 250,
        total: 250,
        customerName: "Done",
        customerPhone: "03009999002",
        deliveryAddress: "Pickup",
        createdAt: new Date((start.getTime() + end.getTime()) / 2),
      },
    });

    const dash = await appRequest(app, "GET", `/admin/dashboard/summary?branchId=${branchId}`, {
      headers: authHeader(adminToken),
    });
    const overview = await appRequest(
      app,
      "GET",
      `/admin/analytics/overview?preset=today&compare=none&branchId=${branchId}`,
      { headers: authHeader(adminToken) }
    );
    expect(dash.status).toBe(200);
    expect(overview.status).toBe(200);

    const d = dash.body as { kpis: { booked: { value: number }; collected: { value: number } } };
    const o = overview.body as { kpis: { booked: { value: number }; collected: { value: number } } };
    expect(o.kpis.booked.value).toBe(d.kpis.booked.value);
    expect(o.kpis.collected.value).toBe(d.kpis.collected.value);
  });
});
