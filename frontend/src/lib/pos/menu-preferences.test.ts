import { describe, expect, it } from "vitest";
import { itemInitial } from "./menu-preferences";

describe("itemInitial", () => {
  it("uses two letters for multi-word names", () => {
    expect(itemInitial("Chicken Karahi")).toBe("CK");
  });
  it("uses first two chars for single word", () => {
    expect(itemInitial("Biryani")).toBe("BI");
  });
});
