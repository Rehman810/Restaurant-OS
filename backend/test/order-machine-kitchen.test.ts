import { describe, expect, it } from "vitest";
import { isKitchenUndoStep, prevStatus } from "../src/lib/order-machine";

describe("kitchen undo transitions", () => {
  it("allows one step back on the fulfillment flow", () => {
    expect(prevStatus("PREPARING", "DELIVERY")).toBe("CONFIRMED");
    expect(isKitchenUndoStep("PREPARING", "CONFIRMED", "DELIVERY")).toBe(true);
    expect(isKitchenUndoStep("PREPARING", "READY", "DELIVERY")).toBe(false);
  });

  it("supports undo from ready handoff", () => {
    expect(isKitchenUndoStep("OUT_FOR_DELIVERY", "READY", "DELIVERY")).toBe(true);
    expect(isKitchenUndoStep("COLLECTED", "READY", "PICKUP")).toBe(true);
  });
});
