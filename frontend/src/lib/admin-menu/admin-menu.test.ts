import { describe, expect, it } from "vitest";
import { escapeCsvCell, dishesToCsv, dryRunImport } from "./csv";
import { availabilityLabel } from "./availability-label";
import { priceChangeNeedsConfirm } from "./price-confirm";
import { dealScheduleStatusLabel, channelSummary } from "./deal-schedule-label";
import { dealSavings, dealPriceWarning, dealComponentSum } from "./deals";
import { parseCategoryStatusParams, categoryStatusToParam } from "./filters-url";
import { categoryScheduleStatusLabel } from "./category-schedule-label";
import { menuTabToParam, parseMenuTab } from "./tab-url";

describe("csv", () => {
  it("escapes formula injection and adds BOM", () => {
    expect(escapeCsvCell("=1+1")).toBe("'=1+1");
    const csv = dishesToCsv([
      {
        id: "1",
        name: "Test",
        description: "",
        category: "Starters",
        price: 100,
        effectivePrice: 100,
        thumbnail: "",
        visibility: "visible",
        availability: { state: "available", reason: null, until: null, untilKind: null },
        optionGroupCount: 0,
        tags: [],
        allergens: [],
        station: null,
        prepMinutes: null,
        sku: null,
        position: 1,
        soldLast30Days: 0,
        updatedAt: "",
        archivedAt: null,
      },
    ]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });

  it("dry-run flags empty names", () => {
    const rows = dryRunImport([{ name: "" }]);
    expect(rows[0].errors.length).toBeGreaterThan(0);
  });
});

describe("availabilityLabel", () => {
  it("labels available and sold out", () => {
    expect(availabilityLabel({ state: "available", reason: null, until: null, untilKind: null })).toBe(
      "Available"
    );
    expect(availabilityLabel({ state: "soldOut", reason: null, until: "endOfDay", untilKind: null })).toContain(
      "today"
    );
  });
});

describe("priceChangeNeedsConfirm", () => {
  it("requires confirm above threshold", () => {
    expect(priceChangeNeedsConfirm(100, 111, 10)).toBe(true);
    expect(priceChangeNeedsConfirm(100, 105, 10)).toBe(false);
  });
});

describe("deal helpers", () => {
  it("labels schedule status", () => {
    expect(dealScheduleStatusLabel("scheduled")).toBe("Scheduled");
  });
  it("summarizes channels", () => {
    expect(channelSummary({ online: true, pos: true, dineIn: false })).toContain("POS");
  });
});

describe("menu tab url", () => {
  it("parses tab query", () => {
    expect(parseMenuTab(null)).toBe("dishes");
    expect(parseMenuTab("deals")).toBe("deals");
    expect(menuTabToParam("dishes")).toBeUndefined();
    expect(menuTabToParam("categories")).toBe("categories");
  });
});

describe("category filters url", () => {
  it("round-trips status params", () => {
    expect(parseCategoryStatusParams("active,hidden")).toEqual(["active", "hidden"]);
    expect(categoryStatusToParam(["scheduled"])).toBe("scheduled");
  });
});

describe("category schedule label", () => {
  it("labels off hours", () => {
    expect(categoryScheduleStatusLabel("scheduled")).toBe("Off hours");
  });
});

describe("deal savings (shared logic)", () => {
  it("matches backend savings math", () => {
    const sum = dealComponentSum([{ quantity: 2, menuItem: { price: 500 } }]);
    expect(dealSavings(sum, 800)).toBe(200);
    expect(dealPriceWarning(sum, 1000)).toBe(true);
  });
});
