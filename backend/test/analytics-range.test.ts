import { describe, expect, it } from "vitest";
import {
  resolveComparisonRange,
  resolvePresetRange,
  startOfMonthKey,
  validateRangeDays,
} from "../src/lib/analytics/range";
import { storeDateKey } from "../src/lib/dashboard/dates";

describe("analytics range resolver", () => {
  const tz = "Asia/Karachi";
  const ref = new Date("2026-10-17T10:00:00Z");

  it("starts this month on the 1st in store timezone", () => {
    const range = resolvePresetRange("this_month", tz, ref);
    expect(range.fromKey).toBe("2026-10-01");
    expect(range.toKey).toBe(storeDateKey(tz, ref));
    expect(startOfMonthKey(tz, ref)).toBe("2026-10-01");
  });

  it("comparison previous period has equal length", () => {
    const primary = resolvePresetRange("this_month", tz, ref);
    const compare = resolveComparisonRange(primary, "previous", tz);
    expect(compare).not.toBeNull();
    const primaryDays =
      Math.round((primary.endUtc.getTime() - primary.startUtc.getTime()) / 86400000) + 1;
    const compareDays =
      Math.round((compare!.endUtc.getTime() - compare!.startUtc.getTime()) / 86400000) + 1;
    expect(compareDays).toBe(primaryDays);
  });

  it("rejects ranges over 400 days", () => {
    expect(() => validateRangeDays("2024-01-01", "2026-10-17", tz)).toThrow();
  });
});
