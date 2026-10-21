import { describe, expect, it } from "vitest";
import { normalizePkPhone } from "../src/lib/settings-validate";

describe("normalizePkPhone", () => {
  it("normalizes local and international formats", () => {
    expect(normalizePkPhone("0300 1234567")).toBe("+923001234567");
    expect(normalizePkPhone("+92 300 1234567")).toBe("+923001234567");
    expect(normalizePkPhone("923001234567")).toBe("+923001234567");
    expect(normalizePkPhone("")).toBe("");
  });
});
