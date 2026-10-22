import { describe, expect, it } from "vitest";
import { adminPathAllowedByPlan, filterNavHref, normalizeEntitlements } from "./plan-entitlements";

const starter = normalizeEntitlements({
  pos: true,
  kitchen: true,
  catalog: true,
  inventory: false,
  dineIn: false,
  analytics: false,
  delivery: false,
  shifts: false,
  dashboard: true,
  auditLog: true,
  branches: false,
});

describe("plan entitlements nav", () => {
  it("starter shows core ops only", () => {
    expect(filterNavHref("/admin", starter)).toBe(true);
    expect(filterNavHref("/admin/pos", starter)).toBe(true);
    expect(filterNavHref("/admin/orders", starter)).toBe(true);
    expect(filterNavHref("/admin/kitchen", starter)).toBe(true);
    expect(filterNavHref("/admin/catalog/dishes", starter)).toBe(true);
    expect(filterNavHref("/admin/customers", starter)).toBe(true);
    expect(filterNavHref("/admin/billing", starter)).toBe(true);

    expect(filterNavHref("/admin/analytics", starter)).toBe(false);
    expect(filterNavHref("/admin/dine-in", starter)).toBe(false);
    expect(filterNavHref("/admin/inventory", starter)).toBe(false);
    expect(filterNavHref("/admin/shifts", starter)).toBe(false);
    expect(filterNavHref("/admin/riders/cash", starter)).toBe(false);
    expect(filterNavHref("/admin/tracking", starter)).toBe(false);
    expect(filterNavHref("/admin/areas", starter)).toBe(false);
    expect(filterNavHref("/admin/branches", starter)).toBe(false);
    expect(filterNavHref("/admin/audit-log", starter)).toBe(true);
  });

  it("blocks direct URL to gated routes", () => {
    expect(adminPathAllowedByPlan("/admin/reports/tax", starter)).toBe(false);
    expect(adminPathAllowedByPlan("/admin/tracking", starter)).toBe(false);
  });
});
