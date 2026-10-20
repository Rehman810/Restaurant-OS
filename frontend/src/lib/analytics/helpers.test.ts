import { describe, expect, it } from "vitest";
import {
  formatDeltaDisplay,
  formatHeatmapHour,
  formatHeatmapHourAxis,
  formatRangeSubtitle,
  pluralizeCustomers,
} from "./helpers";

describe("formatDeltaDisplay", () => {
  it("shows dash for new comparison baseline", () => {
    expect(formatDeltaDisplay(null, "new").text).toBe("—");
  });
  it("inverts good direction for cancellations", () => {
    const d = formatDeltaDisplay(-10, null, true);
    expect(d.direction).toBe("up");
  });
});

describe("pluralizeCustomers", () => {
  it("uses singular for 1", () => {
    expect(pluralizeCustomers(1)).toBe("1 customer");
  });
});

describe("formatHeatmapHour", () => {
  it("uses 12-hour clock", () => {
    expect(formatHeatmapHour(14)).toBe("2:00 PM");
    expect(formatHeatmapHour(0)).toBe("12:00 AM");
  });
  it("axis labels are compact", () => {
    expect(formatHeatmapHourAxis(14)).toBe("2 PM");
  });
});

describe("formatRangeSubtitle", () => {
  it("includes timezone label", () => {
    expect(formatRangeSubtitle("2026-10-01", "2026-10-17", "Asia/Karachi")).toContain("Karachi");
  });
});
