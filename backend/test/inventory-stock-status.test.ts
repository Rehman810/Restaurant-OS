import { describe, expect, it } from "vitest";
import {
  countLowAndOut,
  inventoryDisplayStatus,
  stockLevel,
} from "../src/lib/inventory/stock-status";

describe("stockLevel", () => {
  it("classifies boundaries", () => {
    expect(stockLevel(0, 5)).toBe("OUT");
    expect(stockLevel(-2, 5)).toBe("OUT");
    expect(stockLevel(5, 5)).toBe("LOW");
    expect(stockLevel(0.001, 5)).toBe("LOW");
    expect(stockLevel(5.01, 5)).toBe("OK");
  });
});

describe("inventoryDisplayStatus", () => {
  it("prefers out/low over expiring", () => {
    expect(inventoryDisplayStatus(0, 10, true)).toBe("out");
    expect(inventoryDisplayStatus(3, 10, true)).toBe("low");
    expect(inventoryDisplayStatus(20, 10, true)).toBe("expiring");
    expect(inventoryDisplayStatus(20, 10, false)).toBe("ok");
  });
});

describe("countLowAndOut", () => {
  it("matches KPI low + out for alert badge", () => {
    const rows = [
      { quantity: 0, reorderPoint: 5 },
      { quantity: 2, reorderPoint: 5 },
      { quantity: 10, reorderPoint: 5 },
    ];
    expect(countLowAndOut(rows)).toEqual({ lowCount: 1, outCount: 1, alertCount: 2 });
  });
});
