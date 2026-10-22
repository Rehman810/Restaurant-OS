import { afterEach, describe, expect, it } from "vitest";
import {
  getRestaurantId,
  runWithRestaurant,
  TenantContextError,
  withoutTenant,
} from "../src/lib/restaurant-context";

const originalMode = process.env.SINGLE_TENANT_MODE;
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalMode === undefined) delete process.env.SINGLE_TENANT_MODE;
  else process.env.SINGLE_TENANT_MODE = originalMode;
  process.env.NODE_ENV = originalNodeEnv;
});

describe("tenant context", () => {
  it("throws when production has no request context and single-tenant mode is off", () => {
    process.env.NODE_ENV = "production";
    delete process.env.SINGLE_TENANT_MODE;
    expect(() => getRestaurantId()).toThrow(TenantContextError);
  });

  it("throws when SINGLE_TENANT_MODE is false", () => {
    process.env.SINGLE_TENANT_MODE = "false";
    expect(() => getRestaurantId()).toThrow(TenantContextError);
  });

  it("uses the request restaurant id ahead of the fallback", () => {
    process.env.SINGLE_TENANT_MODE = "true";
    const seen = runWithRestaurant("22222222-2222-4222-8222-222222222222", () => getRestaurantId());
    expect(seen).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("refuses tenant reads inside withoutTenant", () => {
    withoutTenant("unit test", () => {
      expect(() => getRestaurantId()).toThrow(TenantContextError);
    });
  });
});
