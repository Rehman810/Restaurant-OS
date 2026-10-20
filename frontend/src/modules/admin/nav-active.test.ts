import { describe, expect, it } from "vitest";
import { isAdminNavActive } from "./nav-active";

describe("isAdminNavActive", () => {
  const ops = ["/admin/kitchen", "/admin/kitchen/stations", "/admin/pos"];

  it("highlights only print stations on stations page", () => {
    expect(isAdminNavActive("/admin/kitchen/stations", "/admin/kitchen", ops)).toBe(false);
    expect(isAdminNavActive("/admin/kitchen/stations", "/admin/kitchen/stations", ops)).toBe(true);
  });

  it("highlights kitchen on board only", () => {
    expect(isAdminNavActive("/admin/kitchen", "/admin/kitchen", ops)).toBe(true);
    expect(isAdminNavActive("/admin/kitchen", "/admin/kitchen/stations", ops)).toBe(false);
  });

  it("does not highlight dashboard on nested admin routes", () => {
    const overview = ["/admin", "/admin/analytics", "/admin/pos"];
    expect(isAdminNavActive("/admin/pos", "/admin", overview)).toBe(false);
    expect(isAdminNavActive("/admin/pos", "/admin/pos", overview)).toBe(true);
    expect(isAdminNavActive("/admin", "/admin", overview)).toBe(true);
  });
});
