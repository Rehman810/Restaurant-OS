import { describe, expect, it } from "vitest";
import { collectUnassignedDeliveries, trackingRidersToPickerRiders } from "./tracking";
import type { OrderBoardColumnView } from "./tracking";
import type { AdminOrderRow } from "./types";

function row(partial: Partial<AdminOrderRow> & { id: string }): AdminOrderRow {
  const { id, ...rest } = partial;
  return {
    id,
    number: "ORD-1",
    shortNumber: "1",
    shortDisplay: "#1",
    type: partial.type ?? "DELIVERY",
    source: "online",
    status: "CONFIRMED",
    nextActions: [],
    createdAt: new Date().toISOString(),
    statusChangedAt: new Date().toISOString(),
    ageSeconds: 0,
    isLate: false,
    isStale: false,
    customer: { name: "A", phone: "0300" },
    itemsSummary: { lines: [], extraCount: 0, totalItems: 0 },
    table: null,
    address: null,
    rider: null,
    totals: { subtotal: 0, deliveryCharge: 0, taxAmount: 0, discountAmount: 0, total: 100 },
    payment: null,
    possibleDuplicateOf: null,
    print: { receiptPrinted: false, kotPrinted: false, kotPrintCount: 0 },
    notes: { hasNotes: false, hasAllergyHint: false },
    isRush: false,
    needsRider: rest.needsRider,
    ...rest,
  };
}

describe("tracking helpers", () => {
  it("trackingRidersToPickerRiders maps active delivery count", () => {
    const mapped = trackingRidersToPickerRiders([
      {
        id: "r1",
        name: "Ali",
        status: "on_delivery",
        activeDeliveries: [],
        activeDeliveryCount: 2,
        longestOutSinceSeconds: 100,
        codCashHeld: 0,
        location: { locationAvailable: false },
      },
    ]);
    expect(mapped[0].activeDeliveries).toBe(2);
  });

  it("collectUnassignedDeliveries filters delivery needsRider", () => {
    const cols: OrderBoardColumnView[] = [
      {
        id: "CONFIRMED",
        label: "Confirmed",
        count: 2,
        value: 0,
        cards: [
          row({ id: "a", needsRider: true, type: "DELIVERY" }),
          row({ id: "b", needsRider: false, type: "DELIVERY" }),
          row({ id: "c", needsRider: true, type: "PICKUP" }),
        ],
      },
    ];
    expect(collectUnassignedDeliveries(cols).map((r) => r.id)).toEqual(["a"]);
  });
});
