import { describe, expect, it } from "vitest";
import {
  formatBlockerSummary,
  normalizeBranchCodeInput,
  openStatusLabel,
  suggestBranchCodeFromName,
  validateBranchCodeClient,
} from "./helpers";

describe("branch helpers", () => {
  it("normalizes and validates codes", () => {
    expect(normalizeBranchCodeInput("ab-12")).toBe("AB12");
    expect(suggestBranchCodeFromName("Gulberg Main")).toBe("GM");
    expect(validateBranchCodeClient("MAIN")).toBeNull();
    expect(validateBranchCodeClient("A")).not.toBeNull();
  });

  it("formats open status", () => {
    const open = {
      isOpenNow: true,
      hoursSource: "store" as const,
      nextOpenAt: null,
      nextCloseAt: null,
      nextOpenLabel: null,
      nextCloseLabel: "Closes at 11:00 PM",
    };
    expect(openStatusLabel(open, true, true)).toContain("Open");
    expect(openStatusLabel(open, true, false)).toBe("Online ordering off");
  });

  it("summarizes blockers", () => {
    expect(
      formatBlockerSummary([
        { code: "OPEN_ORDERS", label: "Orders in progress", count: 2, href: "/admin/orders" },
      ])
    ).toBe("Orders in progress (2)");
  });
});
