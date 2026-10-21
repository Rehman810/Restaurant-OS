import { describe, expect, it, afterAll } from "vitest";
import { FulfillmentType, OrderStatus, PaymentMethod, Role } from "@prisma/client";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { appRequest } from "./helpers/app-request";
import { authHeader, createTestUser } from "./helpers/auth";
import { ensureDefaultBranch } from "../src/lib/branch-scope";
import { utcRangeForStoreDateKey } from "../src/lib/dashboard/dates";
import { getStoreSettings } from "../src/lib/settings-data";
import { storeDateKey } from "../src/lib/dashboard/dates";
import { aggregatePeriodOrderMetrics } from "../src/lib/metrics/period-stats";

const hasDb = Boolean(process.env.DATABASE_URL);
const app = createApp();

describe.skipIf(!hasDb)("daily summary vs dashboard metrics", () => {
  const ts = Date.now();
  let token = "";

  afterAll(async () => {
    try {
      await prisma.order.deleteMany({ where: { orderNumber: { startsWith: `DS-${ts}` } } });
      await prisma.user.deleteMany({ where: { email: `mgr-ds-${ts}@test.local` } });
    } catch {
      /* no db */
    }
  });

  it("booked and collected match shared metrics for today", async () => {
    const settings = await getStoreSettings();
    const tz = settings.timezone || "Asia/Karachi";
    const branchId = await ensureDefaultBranch();
    const dateKey = storeDateKey(tz);
    const { startUtc, endUtc } = utcRangeForStoreDateKey(dateKey, tz);

    const mgr = await createTestUser({ email: `mgr-ds-${ts}@test.local`, role: Role.MANAGER });
    token = mgr.token;
    await prisma.branchMember.create({ data: { branchId, userId: mgr.user.id } });

    await prisma.order.create({
      data: {
        orderNumber: `DS-${ts}-C`,
        branchId,
        status: OrderStatus.COLLECTED,
        fulfillmentType: FulfillmentType.PICKUP,
        paymentMethod: PaymentMethod.CASH,
        subtotal: 300,
        total: 300,
        customerName: "T",
        customerPhone: "03001112223",
        deliveryAddress: "Pickup",
        createdAt: new Date((startUtc.getTime() + endUtc.getTime()) / 2),
      },
    });

    const metrics = await aggregatePeriodOrderMetrics({ branchId }, startUtc, endUtc);
    const res = await appRequest(app, "GET", `/admin/daily-summary?date=${dateKey}&branchId=${branchId}`, {
      headers: { ...authHeader(token), "X-Branch-Id": branchId },
    });
    expect(res.status).toBe(200);
    const body = res.body as { money: { booked: { value: number }; collected: { value: number } } };
    expect(body.money.booked.value).toBe(metrics.booked);
    expect(body.money.collected.value).toBe(metrics.collected);
  });
});
