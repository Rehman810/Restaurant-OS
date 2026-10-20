import { describe, expect, it } from "vitest";
import {
  deriveShortOrderNumber,
  filterOrderForStation,
  formatKitchenElapsed,
  kitchenTimerTone,
  linePrintStationId,
  orderHasStationItems,
  readyLaneActionLabel,
  sortKitchenLaneOrders,
} from "./helpers";
import type { Order } from "@/lib/types";

describe("deriveShortOrderNumber", () => {
  it("uses last numeric segment", () => {
    expect(deriveShortOrderNumber("ANL-1001").display).toBe("#1001");
    expect(deriveShortOrderNumber("ORD-MAIN-20261019-1001").display).toBe("#1001");
    expect(deriveShortOrderNumber("ORD-1045").display).toBe("#1045");
  });

  it("falls back to tail when no digits", () => {
    const r = deriveShortOrderNumber("GUEST-ALPHA");
    expect(r.short).toBe("ALPHA");
  });
});

describe("formatKitchenElapsed", () => {
  const now = Date.parse("2026-10-20T14:00:00.000Z");

  it("formats sub-hour", () => {
    expect(formatKitchenElapsed("2026-10-20T13:50:00.000Z", now)).toBe("10m");
  });

  it("formats hours with padded minutes", () => {
    expect(formatKitchenElapsed("2026-10-20T12:55:00.000Z", now)).toBe("1h 05m");
  });

  it("does not use calendar strings for multi-day waits", () => {
    const out = formatKitchenElapsed("2026-10-17T12:00:00.000Z", now);
    expect(out).not.toMatch(/Oct/i);
    expect(out).toMatch(/\d+d/);
  });
});

describe("kitchenTimerTone", () => {
  it("steps through thresholds", () => {
    expect(kitchenTimerTone(9)).toBe("normal");
    expect(kitchenTimerTone(10)).toBe("amber");
    expect(kitchenTimerTone(20)).toBe("red");
  });
});

describe("readyLaneActionLabel", () => {
  it("varies by fulfillment type", () => {
    expect(readyLaneActionLabel("DINE_IN")).toBe("Served");
    expect(readyLaneActionLabel("PICKUP")).toBe("Picked up");
    expect(readyLaneActionLabel("DELIVERY")).toBe("Assign rider");
  });
});

describe("station filter", () => {
  const defaultId = "station-default";
  const grillId = "station-grill";

  const order = {
    id: "o1",
    orderNumber: "T-1",
    status: "CONFIRMED",
    total: 0,
    deliveryAddress: "",
    customerName: "",
    customerPhone: "",
    createdAt: new Date().toISOString(),
    items: [
      { id: "i1", menuItemId: "m1", quantity: 1, priceAtOrder: 1, nameAtOrder: "Burger", menuItem: { printStationId: grillId } },
      { id: "i2", menuItemId: "m2", quantity: 1, priceAtOrder: 1, nameAtOrder: "Cola", menuItem: { printStationId: null } },
    ],
  } as import("@/lib/types").Order;

  it("routes unassigned items to default station", () => {
    expect(linePrintStationId(order.items[1], defaultId)).toBe(defaultId);
    expect(orderHasStationItems(order, defaultId, defaultId)).toBe(true);
    expect(orderHasStationItems(order, grillId, defaultId)).toBe(true);
    const grillOnly = filterOrderForStation(order, grillId, defaultId);
    expect(grillOnly.items).toHaveLength(1);
    expect(grillOnly.items[0].nameAtOrder).toBe("Burger");
  });
});

describe("rush and stale helpers", () => {
  it("sorts rush tickets first", () => {
    const base = (id: string, rush: boolean) =>
      ({
        id,
        orderNumber: id,
        status: "CONFIRMED",
        isRush: rush,
        total: 0,
        deliveryAddress: "",
        customerName: "",
        customerPhone: "",
        createdAt: "2026-10-20T12:00:00Z",
        items: [],
      }) as import("@/lib/types").Order;
    const sorted = sortKitchenLaneOrders([base("slow", false), base("fast", true)], "CONFIRMED");
    expect(sorted.map((o) => o.id)).toEqual(["fast", "slow"]);
  });
});

describe("sortKitchenLaneOrders", () => {
  const base = (id: string, createdAt: string, readyAt?: string): Order =>
    ({
      id,
      orderNumber: id,
      status: "CONFIRMED",
      total: 0,
      deliveryAddress: "",
      customerName: "",
      customerPhone: "",
      createdAt,
      readyAt,
      items: [],
    }) as Order;

  it("sorts FIFO by createdAt in New/Cooking", () => {
    const sorted = sortKitchenLaneOrders(
      [base("b", "2026-10-20T13:00:00Z"), base("a", "2026-10-20T12:00:00Z")],
      "CONFIRMED"
    );
    expect(sorted.map((o) => o.id)).toEqual(["a", "b"]);
  });

  it("sorts Ready by readyAt when present", () => {
    const sorted = sortKitchenLaneOrders(
      [
        { ...base("b", "2026-10-20T10:00:00Z"), status: "READY", readyAt: "2026-10-20T13:00:00Z" },
        { ...base("a", "2026-10-20T09:00:00Z"), status: "READY", readyAt: "2026-10-20T12:00:00Z" },
      ],
      "READY"
    );
    expect(sorted.map((o) => o.id)).toEqual(["a", "b"]);
  });
});
