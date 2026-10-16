import { describe, expect, it } from "vitest";
import { FulfillmentType, PaymentMethod } from "@prisma/client";
import { validateOfflineSyncPayload } from "../src/lib/pos-offline-sync";

const base: Parameters<typeof validateOfflineSyncPayload>[0] = {
  clientOrderId: "550e8400-e29b-41d4-a716-446655440000",
  offlineLabel: "OFF-0001",
  clientCreatedAt: new Date().toISOString(),
  deviceLabel: "POS-D-ABCD",
  items: [{ menuItemId: "x", quantity: 1 }],
  fulfillmentType: FulfillmentType.PICKUP,
  paymentMethod: PaymentMethod.CASH,
};

describe("[POS-OFF-01] offline sync validation", () => {
  it("rejects delivery offline", () => {
    const r = validateOfflineSyncPayload({
      ...base,
      fulfillmentType: FulfillmentType.DELIVERY,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/delivery/i);
  });

  it("rejects card offline", () => {
    const r = validateOfflineSyncPayload({
      ...base,
      paymentMethod: PaymentMethod.CARD,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects discount sync", () => {
    const r = validateOfflineSyncPayload({
      ...base,
      discountPercent: 5,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects price override sync", () => {
    const r = validateOfflineSyncPayload({
      ...base,
      items: [{ menuItemId: "x", quantity: 1, unitPriceOverride: 99 }],
    });
    expect(r.ok).toBe(false);
  });

  it("accepts valid pickup cash payload", () => {
    const r = validateOfflineSyncPayload(base);
    expect(r.ok).toBe(true);
  });
});
