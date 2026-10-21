import { describe, expect, it } from "vitest";
import {
  dayStatusLabel,
  formatStoreDateHeading,
  paymentSplitProof,
  pickDelta,
  pluralize,
  shiftDateKey,
} from "./helpers";

describe("daily summary helpers", () => {
  it("formats heading without ISO", () => {
    const h = formatStoreDateHeading("2026-10-21", "Asia/Karachi");
    expect(h).toMatch(/2026/);
    expect(h).not.toMatch(/2026-10-21/);
  });

  it("shifts date keys", () => {
    expect(shiftDateKey("2026-10-21", -1)).toBe("2026-10-20");
  });

  it("payment split proof sums parts", () => {
    const { sum } = paymentSplitProof({ cash: 100, card: 50, codReceived: 25, unspecified: 0 });
    expect(sum).toBe(175);
  });

  it("pickDelta returns nulls when compare none", () => {
    const d = pickDelta(
      {
        value: 10,
        previousYesterday: 5,
        previousSameWeekday: 5,
        deltaYesterdayPercent: 100,
        deltaSameWeekdayPercent: 100,
        deltaYesterdayLabel: null,
        deltaSameWeekdayLabel: null,
      },
      "none"
    );
    expect(d.pct).toBeNull();
  });

  it("day status label", () => {
    expect(dayStatusLabel("final", [])).toBe("Final");
    expect(dayStatusLabel("provisional", ["2 shifts open"])).toContain("Provisional");
  });

  it("pluralize", () => {
    expect(pluralize(1, "shift")).toBe("shift");
    expect(pluralize(2, "shift")).toBe("shifts");
  });
});
