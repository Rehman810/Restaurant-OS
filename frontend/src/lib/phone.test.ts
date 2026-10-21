import { describe, expect, it } from "vitest";
import { mapsDirectionsUrl, normalizePkPhone, pkPhoneForWhatsApp, pkPhoneMatchKey } from "./phone";

describe("phone helpers", () => {
  it("matches backend PK normalization", () => {
    expect(normalizePkPhone("03001234567")).toBe("+923001234567");
  });

  it("normalizes match keys across PK formats", () => {
    expect(pkPhoneMatchKey("0300 1234567")).toBe("3001234567");
    expect(pkPhoneMatchKey("+92 300-123-4567")).toBe("3001234567");
    expect(pkPhoneMatchKey("92 300 1234567")).toBe("3001234567");
    expect(pkPhoneForWhatsApp("0300-1234567")).toBe("923001234567");
  });

  it("builds maps URL when coordinates valid", () => {
    expect(mapsDirectionsUrl(33.68, 73.04)).toContain("google.com/maps");
    expect(mapsDirectionsUrl(Number.NaN, Number.NaN)).toBeNull();
  });
});
