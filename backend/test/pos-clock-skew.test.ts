import { describe, expect, it } from "vitest";
import { clientClockSkewMinutes, clockSkewFlag } from "../src/lib/pos-clock-skew";

describe("[POS-OFF-02] clock skew", () => {
  it("computes skew in minutes", () => {
    const server = new Date("2026-10-17T12:00:00Z");
    const client = new Date("2026-10-17T12:15:00Z");
    expect(clientClockSkewMinutes(client, server)).toBe(15);
  });

  it("flags when above threshold", () => {
    expect(clockSkewFlag(12, 10)).toBe(true);
    expect(clockSkewFlag(5, 10)).toBe(false);
  });
});
