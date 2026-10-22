import { describe, expect, it } from "vitest";
import { ADMIN_NAV_SECTIONS } from "@/modules/admin/navigation";
import { planModuleForNavHref, PLAN_EXEMPT_ADMIN_PATHS } from "./plan-module-catalog";

describe("plan module ↔ sidebar menus", () => {
  it("every admin nav link maps to a module or is plan-exempt", () => {
    const missing: string[] = [];
    for (const section of ADMIN_NAV_SECTIONS) {
      for (const item of section.items) {
        const mod = planModuleForNavHref(item.href);
        const exempt = PLAN_EXEMPT_ADMIN_PATHS.includes(item.href);
        if (!mod && !exempt) missing.push(`${item.label} (${item.href})`);
      }
    }
    expect(missing).toEqual([]);
  });
});
