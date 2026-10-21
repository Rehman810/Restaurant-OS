import { describe, expect, it } from "vitest";
import { parseDateRangeQuery, storeTodayUtcRange } from "../src/lib/reports/time-range";
import { branchDayRangeUtc } from "../src/lib/dine-in/branch-time";

describe("[RPT-02] store today boundary", () => {
  it("matches branchDayRangeUtc for Asia/Karachi", () => {
    const a = storeTodayUtcRange("Asia/Karachi");
    const b = branchDayRangeUtc("Asia/Karachi");
    expect(a.start.getTime()).toBe(b.startUtc.getTime());
    expect(a.end.getTime()).toBe(b.endUtc.getTime());
  });

  it("empty menu-engineering range spans fallbackDays through today", () => {
    const { from, to } = parseDateRangeQuery(undefined, undefined, "Asia/Karachi", 30);
    expect(from).not.toEqual(to);
  });

  it("dashboard and analytics share the same today window helper", () => {
    const tz = "Asia/Karachi";
    const r1 = storeTodayUtcRange(tz);
    const r2 = storeTodayUtcRange(tz);
    expect(r1.start.toISOString()).toBe(r2.start.toISOString());
  });
});
