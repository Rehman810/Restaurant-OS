import { describe, expect, it } from "vitest";
import { deliveryAreaRowsForCity } from "../src/lib/platform/delivery-area-templates";
import { KARACHI_AREAS } from "../src/lib/karachi-areas";

describe("deliveryAreaRowsForCity", () => {
  it("returns Karachi full list", () => {
    const rows = deliveryAreaRowsForCity("Karachi");
    expect(rows.length).toBe(KARACHI_AREAS.length);
    expect(rows.some((r) => r.name === "DHA Phase 5")).toBe(true);
  });

  it("returns generic zones for other cities", () => {
    const rows = deliveryAreaRowsForCity("Lahore");
    expect(rows.length).toBe(6);
    expect(rows[0].name).toContain("Lahore");
  });

  it("returns empty for blank city", () => {
    expect(deliveryAreaRowsForCity("  ")).toEqual([]);
  });
});
