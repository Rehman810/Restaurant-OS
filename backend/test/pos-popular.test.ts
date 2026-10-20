import { describe, expect, it } from "vitest";
import { posPopularMenuItemIds } from "../src/lib/pos-popular";

describe("[POS-MENU-01] posPopularMenuItemIds", () => {
  it("exports a function", () => {
    expect(typeof posPopularMenuItemIds).toBe("function");
  });
});
