import { describe, expect, it } from "vitest";
import { FulfillmentType, OrderStatus, PaymentMethod, Role } from "@prisma/client";
import { deriveOrderPayment } from "../src/lib/admin-orders/payment";
import { findPossibleDuplicateOf, itemMultisetKey, normalizeOrderPhone } from "../src/lib/admin-orders/duplicates";
import { nextActionsForRole } from "../src/lib/admin-orders/next-actions";
import { deriveShortOrderNumber } from "../src/lib/order-number";
import { canTransitionStatus } from "../src/lib/order-status";

describe("admin orders helpers", () => {
  it("deriveShortOrderNumber handles POS and legacy formats", () => {
    expect(deriveShortOrderNumber("ORD-MAIN-20261020-1010").shortDisplay).toBe("#1010");
    expect(deriveShortOrderNumber("ANL-1001").shortDisplay).toBe("#1001");
  });

  it("payment: paid POS cash", () => {
    const d = deriveOrderPayment({
      paymentStatus: "PAID",
      paymentMethod: PaymentMethod.CASH,
      total: 1000,
      fulfillmentType: FulfillmentType.PICKUP,
      status: OrderStatus.COLLECTED,
      payments: [{ method: PaymentMethod.CASH, amount: 1000 }],
    });
    expect(d.status).toBe("paid");
  });

  it("payment: COD delivery unpaid", () => {
    const d = deriveOrderPayment({
      paymentStatus: "UNPAID",
      paymentMethod: null,
      total: 1920,
      fulfillmentType: FulfillmentType.DELIVERY,
      status: OrderStatus.OUT_FOR_DELIVERY,
      payments: [],
    });
    expect(d.status).toBe("cod");
    expect(d.codAmount).toBe(1920);
  });

  it("duplicate detection matches phone and lines within window", () => {
    const base = new Date("2026-10-20T12:10:00Z");
    const earlier = new Date("2026-10-20T12:09:00Z");
    const items = [{ menuItemId: "a", quantity: 2 }];
    const dup = findPossibleDuplicateOf(
      { id: "2", createdAt: base, customerPhone: "0300-1112233", items },
      [
        {
          id: "1",
          createdAt: earlier,
          customerPhone: "+92 300 1112233",
          items,
        },
      ],
      10
    );
    expect(dup).toBe("1");
    expect(
      findPossibleDuplicateOf(
        { id: "2", createdAt: base, customerPhone: "03001112233", items },
        [
          {
            id: "1",
            createdAt: earlier,
            customerPhone: "03001112233",
            items: [{ menuItemId: "b", quantity: 2 }],
          },
        ],
        10
      )
    ).toBeNull();
  });

  it("next action for dine-in skips out for delivery", () => {
    const actions = nextActionsForRole(Role.MANAGER, OrderStatus.READY, FulfillmentType.DINE_IN);
    expect(actions[0]?.targetStatus).toBe(OrderStatus.SERVED);
    expect(canTransitionStatus(OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY, FulfillmentType.DINE_IN)).toBe(
      false
    );
  });

  it("normalize phone and multiset", () => {
    expect(normalizeOrderPhone("+92 300 1234567")).toBe("3001234567");
    expect(itemMultisetKey([{ menuItemId: "b", quantity: 1 }, { menuItemId: "a", quantity: 2 }])).toBe(
      "a:2|b:1"
    );
  });
});
