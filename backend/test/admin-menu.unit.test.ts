import { SoldOutUntilKind } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { resolveAvailability, soldOutPatchToRow } from "../src/lib/admin-menu/availability";
import { dealPriceWarning, dealSavings, dealComponentSum } from "../src/lib/admin-menu/deals";
import { evaluateCategorySchedule, categoryScheduleSummary } from "../src/lib/admin-menu/category-schedule";

describe("menu availability", () => {
  it("treats missing override as available", () => {
    const r = resolveAvailability(null, "Asia/Karachi", false);
    expect(r.state).toBe("available");
  });

  it("honours sold out until end of store day", () => {
    const row = soldOutPatchToRow({ state: "soldOut", until: "endOfDay" }, "Asia/Karachi");
    expect(row.untilKind).toBe(SoldOutUntilKind.END_OF_STORE_DAY);
    expect(row.soldOut).toBe(true);
    const resolved = resolveAvailability(
      {
        soldOut: true,
        untilKind: row.untilKind,
        untilAt: row.untilAt,
        reason: "",
        setById: null,
        setAt: new Date(),
      },
      "Asia/Karachi"
    );
    expect(resolved.state).toBe("soldOut");
  });
});

describe("category schedule", () => {
  it("marks hidden when not visible", () => {
    expect(evaluateCategorySchedule({ isVisible: false, archivedAt: null, scheduleDays: [], scheduleStartMinutes: null, scheduleEndMinutes: null })).toBe("hidden");
  });

  it("formats schedule summary", () => {
    const s = categoryScheduleSummary({ scheduleDays: [1, 5], scheduleStartMinutes: 600, scheduleEndMinutes: 1320 });
    expect(s).toContain("Mon");
    expect(s).toContain("10:00");
  });
});

describe("deal savings", () => {
  it("computes savings and warns when price exceeds components", () => {
    const sum = dealComponentSum([{ quantity: 2, menuItem: { price: 500 } }]);
    expect(sum).toBe(1000);
    expect(dealSavings(sum, 800)).toBe(200);
    expect(dealPriceWarning(sum, 1000)).toBe(true);
    expect(dealPriceWarning(sum, 900)).toBe(false);
  });
});
