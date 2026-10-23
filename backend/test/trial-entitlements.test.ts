import { describe, expect, it } from "vitest";
import { entitlementsForActiveTrial, resolveModuleAccess } from "../src/lib/platform/entitlements";
import { isFullModuleAccess } from "../src/lib/platform/module-access";
import { PLAN_MODULE_IDS } from "../src/lib/platform/plan-modules";

describe("entitlementsForActiveTrial", () => {
  it("enables every plan module with full access", () => {
    const ent = entitlementsForActiveTrial();
    expect(ent.maxBranches).toBeNull();
    expect(ent.maxStaff).toBeNull();
    for (const id of PLAN_MODULE_IDS) {
      expect(isFullModuleAccess(resolveModuleAccess(ent, id))).toBe(true);
    }
  });
});
