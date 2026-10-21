import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import {
  assertSettingsSectionAccess,
  listSettingsSectionsForRole,
  rolesForSettingsSection,
} from "../src/lib/settings-sections";

describe("settings-sections", () => {
  it("lists all sections for admin", () => {
    const ids = listSettingsSectionsForRole(Role.ADMIN);
    expect(ids).toContain("branding-theme");
    expect(ids).toContain("my-account");
  });

  it("limits manager to my-account", () => {
    expect(listSettingsSectionsForRole(Role.MANAGER)).toEqual(["my-account"]);
    expect(() => assertSettingsSectionAccess(Role.MANAGER, "branding-theme")).toThrow();
    expect(rolesForSettingsSection("my-account")).toEqual([Role.ADMIN, Role.MANAGER]);
  });

  it("denies other roles", () => {
    expect(listSettingsSectionsForRole(Role.CASHIER)).toEqual([]);
    expect(() => assertSettingsSectionAccess(Role.CASHIER, "notifications")).toThrow();
  });
});
