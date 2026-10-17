import { describe, expect, it } from "vitest";
import { OrderStatus } from "@prisma/client";
import {
  isActiveIncomingStatus,
  sortIncomingPipelineOrders,
} from "../src/lib/dashboard/order-completion";

describe("dashboard incoming pipeline", () => {
  const thresholds = { lateConfirmMinutes: 5, latePrepMinutes: 20, lateDeliveryMinutes: 45 };

  it("only treats pipeline statuses as active incoming", () => {
    expect(isActiveIncomingStatus(OrderStatus.PREPARING)).toBe(true);
    expect(isActiveIncomingStatus(OrderStatus.COLLECTED)).toBe(false);
    expect(isActiveIncomingStatus(OrderStatus.CANCELLED)).toBe(false);
  });

  it("sorts late orders ahead of on-time, then oldest updatedAt", () => {
    const sorted = sortIncomingPipelineOrders(
      [
        {
          status: OrderStatus.CONFIRMED,
          minutesInStatus: 2,
          updatedAt: "2026-01-01T08:00:00Z",
        },
        {
          status: OrderStatus.PREPARING,
          minutesInStatus: 25,
          updatedAt: "2026-01-01T10:00:00Z",
        },
        {
          status: OrderStatus.READY,
          minutesInStatus: 3,
          updatedAt: "2026-01-01T07:00:00Z",
        },
      ],
      thresholds
    );
    expect(sorted[0].status).toBe(OrderStatus.PREPARING);
    expect(sorted[1].status).toBe(OrderStatus.READY);
    expect(sorted[2].status).toBe(OrderStatus.CONFIRMED);
  });
});
