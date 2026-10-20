import { describe, expect, it } from "vitest";
import { canDropOnColumn, nextDropColumn, targetStatusForBoardColumn } from "./board-dnd";
import type { AdminOrderRow } from "./types";

function row(partial: Partial<AdminOrderRow> & Pick<AdminOrderRow, "status" | "type">): AdminOrderRow {
  return {
    id: "1",
    number: "ORD-1",
    shortNumber: "1",
    shortDisplay: "#1",
    source: "pos",
    nextActions: partial.nextActions ?? [
      { action: "transition", targetStatus: "PREPARING", label: "Start preparing", primary: true },
    ],
    createdAt: new Date().toISOString(),
    statusChangedAt: new Date().toISOString(),
    ageSeconds: 0,
    isLate: false,
    isStale: false,
    customer: { name: "A", phone: "", phoneMasked: false },
    itemsSummary: { lines: [], extraCount: 0, totalItems: 0 },
    table: null,
    address: null,
    rider: null,
    totals: { subtotal: 0, deliveryCharge: 0, taxAmount: 0, discountAmount: 0, total: 0 },
    payment: null,
    possibleDuplicateOf: null,
    print: { receiptPrinted: false, kotPrinted: false, kotPrintCount: 0 },
    notes: { hasNotes: false, hasAllergyHint: false },
    isRush: false,
    needsRider: false,
    outcome: null,
    riderOutSinceSeconds: null,
    ...partial,
  };
}

describe("board-dnd", () => {
  it("maps completed column by fulfillment type", () => {
    expect(targetStatusForBoardColumn("COMPLETED", row({ status: "READY", type: "DELIVERY" }))).toBe(
      "DELIVERED"
    );
    expect(targetStatusForBoardColumn("COMPLETED", row({ status: "READY", type: "PICKUP" }))).toBe(
      "COLLECTED"
    );
  });

  it("allows drop only on the next column from primary action", () => {
    const r = row({
      status: "CONFIRMED",
      type: "PICKUP",
      nextActions: [{ action: "transition", targetStatus: "PREPARING", label: "Start", primary: true }],
    });
    expect(nextDropColumn(r)).toBe("PREPARING");
    expect(canDropOnColumn("PREPARING", r)).toBe(true);
    expect(canDropOnColumn("READY", r)).toBe(false);
  });
});
