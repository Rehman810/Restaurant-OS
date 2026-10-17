import { describe, expect, it } from "vitest";
import { lastNStoreDateKeys, shiftStoreDateKey, storeDateKey } from "../src/lib/dashboard/dates";
import { branchDayRangeUtc } from "../src/lib/dine-in/branch-time";

describe("dashboard store dates", () => {
  const tz = "Asia/Karachi";

  it("last7Days has 7 consecutive keys ending today", () => {
    const ref = new Date("2026-10-17T10:00:00Z");
    const keys = lastNStoreDateKeys(tz, 7, ref);
    expect(keys).toHaveLength(7);
    expect(keys[6]).toBe(storeDateKey(tz, ref));
    expect(keys[0]).toBe(shiftStoreDateKey(keys[6], -6, tz));
  });

  it("orders at 23:50 and 00:10 fall in correct store days", () => {
    const late = new Date("2026-10-16T18:50:00Z"); // ~23:50 PKT Oct 16
    const early = new Date("2026-10-16T19:10:00Z"); // ~00:10 PKT Oct 17
    const dayLate = storeDateKey(tz, late);
    const dayEarly = storeDateKey(tz, early);
    expect(dayLate).not.toBe(dayEarly);

    const { startUtc, endUtc } = branchDayRangeUtc(tz, early);
    expect(early.getTime()).toBeGreaterThanOrEqual(startUtc.getTime());
    expect(early.getTime()).toBeLessThanOrEqual(endUtc.getTime());
  });
});
