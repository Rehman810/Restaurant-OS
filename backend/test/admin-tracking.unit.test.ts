import { describe, expect, it } from "vitest";
import { FulfillmentType, OrderStatus } from "@prisma/client";
import {
  boardColumnForStatus,
  orderBelongsInColumn,
} from "../src/lib/admin-orders/board-columns";
import { computeTrackingBoardSummaryFromOrders } from "../src/lib/metrics/tracking-board";

describe("tracking board columns", () => {
  it("maps completed statuses into COMPLETED", () => {
    expect(boardColumnForStatus(OrderStatus.DELIVERED)).toBe("COMPLETED");
    expect(boardColumnForStatus(OrderStatus.COLLECTED)).toBe("COMPLETED");
    expect(boardColumnForStatus(OrderStatus.SERVED)).toBe("COMPLETED");
  });

  it("dine-in and takeaway skip Out for delivery column", () => {
    expect(
      orderBelongsInColumn(OrderStatus.READY, FulfillmentType.DINE_IN, "OUT_FOR_DELIVERY")
    ).toBe(false);
    expect(
      orderBelongsInColumn(OrderStatus.OUT_FOR_DELIVERY, FulfillmentType.DELIVERY, "OUT_FOR_DELIVERY")
    ).toBe(true);
  });
});

describe("tracking board summary", () => {
  const thresholds = {
    lateConfirmMinutes: 15,
    latePrepMinutes: 30,
    lateDeliveryMinutes: 45,
    ordersStaleHours: 2,
  };

  it("pipeline value excludes completed and counts unassigned deliveries", () => {
    const now = new Date("2026-10-20T14:00:00Z");
    const old = new Date("2026-10-20T10:00:00Z");
    const summary = computeTrackingBoardSummaryFromOrders(
      [
        {
          id: "1",
          status: OrderStatus.CONFIRMED,
          fulfillmentType: FulfillmentType.DELIVERY,
          riderId: null,
          total: 1000 as never,
          updatedAt: old,
          createdAt: old,
          events: [{ toStatus: OrderStatus.CONFIRMED, createdAt: old }],
        },
        {
          id: "2",
          status: OrderStatus.PREPARING,
          fulfillmentType: FulfillmentType.PICKUP,
          riderId: null,
          total: 500 as never,
          updatedAt: now,
          createdAt: now,
          events: [{ toStatus: OrderStatus.PREPARING, createdAt: now }],
        },
      ],
      thresholds,
      now
    );
    expect(summary.active).toBe(2);
    expect(summary.pipelineValue).toBe(1500);
    expect(summary.unassignedDeliveries).toBe(1);
  });
});
