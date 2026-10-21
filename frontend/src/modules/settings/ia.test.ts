import { describe, expect, it } from "vitest";
import {
  LEGACY_SETTINGS_TAB_REDIRECT,
  SETTINGS_SECTIONS,
  isSettingsSectionId,
  roleMayAccessSettingsSection,
  searchSettings,
} from "./ia";

describe("settings ia", () => {
  it("maps legacy tabs", () => {
    expect(LEGACY_SETTINGS_TAB_REDIRECT.hours).toBe("hours-availability");
    expect(LEGACY_SETTINGS_TAB_REDIRECT.security).toBe("my-account");
  });

  it("validates section ids", () => {
    expect(isSettingsSectionId("branding-theme")).toBe(true);
    expect(isSettingsSectionId("nope")).toBe(false);
  });

  it("searches labels", () => {
    const hits = searchSettings("minimum order");
    expect(hits.some((h) => h.sectionId === "orders-delivery")).toBe(true);
  });

  it("gates sections by role", () => {
    expect(roleMayAccessSettingsSection("ADMIN", "integrations")).toBe(true);
    expect(roleMayAccessSettingsSection("MANAGER", "integrations")).toBe(false);
    expect(roleMayAccessSettingsSection("MANAGER", "my-account")).toBe(true);
    expect(roleMayAccessSettingsSection("CASHIER", "my-account")).toBe(false);
  });

  it("lists sixteen admin sections plus my-account for managers", () => {
    const adminSections = SETTINGS_SECTIONS.filter((s) => roleMayAccessSettingsSection("ADMIN", s.id));
    const managerSections = SETTINGS_SECTIONS.filter((s) => roleMayAccessSettingsSection("MANAGER", s.id));
    expect(adminSections).toHaveLength(16);
    expect(managerSections).toHaveLength(1);
    expect(managerSections[0]?.id).toBe("my-account");
  });
});
