import { describe, expect, it } from "vitest";
import { mobileBoardTabIds } from "./mobile-board-tabs";
import type { OrderBoardColumnView } from "./tracking";

describe("mobileBoardTabIds", () => {
  it("includes pending confirmation when non-empty", () => {
    const cols: OrderBoardColumnView[] = [
      { id: "PENDING_CONFIRMATION", label: "Awaiting", count: 2, cards: [], value: 0 },
      { id: "CONFIRMED", label: "Confirmed", count: 0, cards: [], value: 0 },
    ];
    expect(mobileBoardTabIds(cols)[0]).toBe("PENDING_CONFIRMATION");
  });

  it("omits pending when empty", () => {
    const cols: OrderBoardColumnView[] = [
      { id: "PENDING_CONFIRMATION", label: "Awaiting", count: 0, cards: [], value: 0 },
      { id: "CONFIRMED", label: "Confirmed", count: 1, cards: [], value: 0 },
    ];
    expect(mobileBoardTabIds(cols)).not.toContain("PENDING_CONFIRMATION");
    expect(mobileBoardTabIds(cols)[0]).toBe("CONFIRMED");
  });
});
