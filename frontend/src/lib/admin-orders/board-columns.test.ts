import { describe, expect, it } from "vitest";
import { boardColumnForRow, rowBelongsInColumn } from "./board-columns";
import type { AdminOrderRow } from "./types";

function row(partial: Partial<AdminOrderRow> & { status: AdminOrderRow["status"]; type: AdminOrderRow["type"] }): AdminOrderRow {
  return {
    id: "1",
    number: "ORD-1",
    shortNumber: "1",
    shortDisplay: "#1",
    source: "online",
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
    totals: { subtotal: 0, deliveryCharge: 0, taxAmount: 0, discountAmount: 0, total: 0 },
    payment: null,
    possibleDuplicateOf: null,
    print: { receiptPrinted: false, kotPrinted: false, kotPrintCount: 0 },
    notes: { hasNotes: false, hasAllergyHint: false },
    isRush: false,
    ...partial,
  };
}

describe("board columns", () => {
  it("maps completed terminals to COMPLETED", () => {
    expect(boardColumnForRow(row({ status: "SERVED", type: "DINE_IN" }))).toBe("COMPLETED");
  });

  it("dine-in not in out for delivery column", () => {
    const dine = row({ status: "READY", type: "DINE_IN" });
    expect(rowBelongsInColumn(dine, "OUT_FOR_DELIVERY")).toBe(false);
    expect(rowBelongsInColumn(dine, "READY")).toBe(true);
  });

  it("delivery out column only for OUT_FOR_DELIVERY status", () => {
    const del = row({ status: "OUT_FOR_DELIVERY", type: "DELIVERY" });
    expect(rowBelongsInColumn(del, "OUT_FOR_DELIVERY")).toBe(true);
  });
});
