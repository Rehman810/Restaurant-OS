import { describe, expect, it } from "vitest";
import { canTransition, flowFor, nextStatus } from "../src/lib/order-machine";

const FULFILLMENTS = ["DELIVERY", "PICKUP", "DINE_IN"] as const;

describe("[ORD-10] exhaustive legal steps", () => {
  for (const fulfillment of FULFILLMENTS) {
    it(`allows only +1 forward steps for ${fulfillment}`, () => {
      const flow = flowFor(fulfillment);
      for (let i = 0; i < flow.length - 1; i++) {
        const from = flow[i];
        const to = flow[i + 1];
        expect(canTransition(from, to, fulfillment)).toBe(true);
        expect(nextStatus(from, fulfillment)).toBe(to);
      }
    });

    it(`rejects skips and backwards moves for ${fulfillment}`, () => {
      const flow = flowFor(fulfillment);
      for (let i = 0; i < flow.length; i++) {
        for (let j = 0; j < flow.length; j++) {
          if (j === i || j === i + 1) continue;
          expect(canTransition(flow[i], flow[j], fulfillment)).toBe(false);
        }
      }
    });
  }
});

describe("[ORD-11] cancel", () => {
  it("allows cancel from non-terminal statuses", () => {
    expect(canTransition("CONFIRMED", "CANCELLED", "DELIVERY")).toBe(true);
    expect(canTransition("DELIVERED", "CANCELLED", "DELIVERY")).toBe(false);
  });
});
