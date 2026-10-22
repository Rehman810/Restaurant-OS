import { describe, expect, it } from "vitest";
import { TenantStatus } from "@prisma/client";
import { createApp } from "../src/app";
import { appRequest } from "./helpers/app-request";
import { basePrisma } from "../src/lib/prisma-base";
import { DEFAULT_RESTAURANT_ID } from "../src/lib/restaurant-context";
import { runTenantLifecycleJob } from "../src/lib/platform/lifecycle-job";
import {
  assertTenantStatusTransition,
  lifecycleGate,
  tenantAccessForStatus,
} from "../src/lib/platform/tenant-lifecycle";

const hasDb = Boolean(process.env.DATABASE_URL?.includes("test"));
const app = createApp();

describe("tenant lifecycle rules", () => {
  it("past due tenants block mutations except billing", () => {
    const access = tenantAccessForStatus(TenantStatus.PAST_DUE, "Trial ended");
    expect(access.adminReadOnly).toBe(true);
    const blocked = lifecycleGate(access, "POST", "/admin/orders");
    expect(blocked.blocked).toBe(true);
    const billing = lifecycleGate(access, "POST", "/admin/billing/invoices");
    expect(billing.blocked).toBe(false);
  });

  it("suspended tenants allow staff login but block checkout", () => {
    const access = tenantAccessForStatus(TenantStatus.SUSPENDED, "Maintenance");
    expect(access.allowStaffLogin).toBe(true);
    expect(access.adminReadOnly).toBe(true);
    const gate = lifecycleGate(access, "POST", "/orders");
    expect(gate.blocked).toBe(true);
    expect(gate.code).toBe("TENANT_ACCESS_LIMITED");
  });

  it("rejects invalid status transitions", () => {
    expect(() => assertTenantStatusTransition(TenantStatus.ARCHIVED, TenantStatus.ACTIVE)).toThrow();
  });
});

describe.skipIf(!hasDb)("tenant lifecycle HTTP", () => {
  it("blocks checkout when suspended", async () => {
    await basePrisma.restaurant.update({
      where: { id: DEFAULT_RESTAURANT_ID },
      data: { status: TenantStatus.SUSPENDED, statusReason: "Test suspension" },
    });
    const res = await appRequest(app, "POST", "/orders", {
      body: { items: [] },
    });
    expect(res.status).toBe(403);
    await basePrisma.restaurant.update({
      where: { id: DEFAULT_RESTAURANT_ID },
      data: { status: TenantStatus.ACTIVE, statusReason: "" },
    });
  });

  it("archives cancelled tenants after retention", async () => {
    const past = new Date("2019-01-01T00:00:00.000Z");
    await basePrisma.restaurant.update({
      where: { id: DEFAULT_RESTAURANT_ID },
      data: {
        status: TenantStatus.CANCELLED,
        deleteScheduledAt: past,
        statusReason: "Test cancel",
      },
    });
    const result = await runTenantLifecycleJob(new Date("2020-01-01T00:00:00.000Z"));
    expect(result).toMatchObject({ archived: 1 });
    const row = await basePrisma.restaurant.findUnique({ where: { id: DEFAULT_RESTAURANT_ID } });
    expect(row?.status).toBe(TenantStatus.ARCHIVED);
    await basePrisma.restaurant.update({
      where: { id: DEFAULT_RESTAURANT_ID },
      data: {
        status: TenantStatus.ACTIVE,
        statusReason: "",
        deleteScheduledAt: null,
        archivedAt: null,
      },
    });
  });
});
