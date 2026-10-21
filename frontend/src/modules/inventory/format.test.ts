import { describe, expect, it } from "vitest";
import { formatQty } from "./format";

describe("formatQty", () => {
  it("formats KG with 2 decimals", () => {
    expect(formatQty(3.985, "KG")).toBe("3.99 KG");
  });

  it("formats PIECE as integers", () => {
    expect(formatQty(1200.2, "PIECE")).toBe("1,200 PIECE");
  });
});
