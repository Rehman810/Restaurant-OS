import { describe, expect, it } from "vitest";
import { suggestedReorderQty } from "../src/lib/inventory/reorder";

describe("suggestedReorderQty", () => {
  it("uses par level when set", () => {
    expect(suggestedReorderQty(3, 20, 5)).toBe(17);
  });

  it("falls back to 2x reorder", () => {
    expect(suggestedReorderQty(4, null, 5)).toBe(6);
  });

  it("never returns negative", () => {
    expect(suggestedReorderQty(50, 20, 5)).toBe(0);
  });
});
