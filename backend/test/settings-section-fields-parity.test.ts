import { describe, expect, it } from "vitest";
import { SETTINGS_SECTION_IDS } from "../src/lib/settings-sections";
import { SETTINGS_SECTION_FIELDS } from "../src/lib/settings-section-fields";

describe("settings section fields", () => {
  it("has field lists for every section id", () => {
    for (const id of SETTINGS_SECTION_IDS) {
      expect(Array.isArray(SETTINGS_SECTION_FIELDS[id])).toBe(true);
    }
  });

  it("keeps my-account and banners off the PATCH form", () => {
    expect(SETTINGS_SECTION_FIELDS["my-account"]).toEqual([]);
    expect(SETTINGS_SECTION_FIELDS.banners).toEqual([]);
  });
});
