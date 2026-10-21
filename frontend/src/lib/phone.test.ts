import { describe, expect, it } from "vitest";
import { mapsDirectionsUrl, normalizePkPhone } from "./phone";

describe("phone helpers", () => {
  it("matches backend PK normalization", () => {
    expect(normalizePkPhone("03001234567")).toBe("+923001234567");
  });

  it("builds maps URL when coordinates valid", () => {
    expect(mapsDirectionsUrl(33.68, 73.04)).toContain("google.com/maps");
    expect(mapsDirectionsUrl("", null)).toBeNull();
  });
});
