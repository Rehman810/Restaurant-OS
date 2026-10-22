import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { appRequest } from "./helpers/app-request";
import { authHeader, tenantSlugHeader } from "./helpers/auth";
import {
  setupCrossTenantFixture,
  teardownCrossTenantFixture,
  type CrossTenantFixture,
} from "./helpers/isolation-fixture";

const hasDb = Boolean(process.env.DATABASE_URL);
const app = createApp();

describe.skipIf(!hasDb)("isolation route walker (IDOR)", () => {
  const suffix = randomUUID().slice(0, 8);
  let fixture: CrossTenantFixture;
  let prevSingle: string | undefined;

  beforeAll(async () => {
    prevSingle = process.env.SINGLE_TENANT_MODE;
    process.env.SINGLE_TENANT_MODE = "false";
    fixture = await setupCrossTenantFixture(suffix);
  });

  afterAll(async () => {
    if (fixture) await teardownCrossTenantFixture(fixture);
    if (prevSingle === undefined) delete process.env.SINGLE_TENANT_MODE;
    else process.env.SINGLE_TENANT_MODE = prevSingle;
  });

  it("GET /orders/:id returns 403 or 404 for foreign tenant order", async () => {
    const res = await appRequest(app, "GET", `/orders/${fixture.orderBId}`, {
      headers: { ...authHeader(fixture.adminAToken), ...tenantSlugHeader(fixture.slugA) },
    });
    expect([403, 404]).toContain(res.status);
  });
});
