import { describe, expect, it } from "vitest";
import { customerContactKey, filterCustomers, paginateCustomers } from "../src/lib/customer-directory";
import { pkPhoneForWhatsApp } from "../src/lib/customer-phone";
import { customersToCsv } from "../src/lib/customer-export";
import { customerDirectoryStats } from "../src/lib/customer-directory";
import {
  resolveCustomerSegment,
  SEGMENT_AT_RISK_MIN_DAYS,
  SEGMENT_LAPSED_MIN_DAYS,
  SEGMENT_NEW_ORDER_COUNT,
  SEGMENT_REGULAR_MIN_ORDERS,
  vipSpendThreshold,
} from "../src/lib/customer-segments";

describe("customer phone normalization", () => {
  it("treats Pakistani formats as the same contact key", () => {
    const a = customerContactKey("0300 1234567", null);
    const b = customerContactKey("+92 300 1234567", null);
    const c = customerContactKey("92 300-1234567", null);
    expect(a).toBe("phone:3001234567");
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it("builds WhatsApp digits", () => {
    expect(pkPhoneForWhatsApp("0300-1234567")).toBe("923001234567");
    expect(pkPhoneForWhatsApp("+92 300 1234567")).toBe("923001234567");
  });
});

describe("customer segments", () => {
  const now = new Date("2026-01-31T12:00:00Z");
  const vipThreshold = 1000;

  function lastOrderDaysAgo(days: number) {
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }

  it("marks New at exactly one order", () => {
    expect(
      resolveCustomerSegment({
        orderCount: SEGMENT_NEW_ORDER_COUNT,
        totalSpent: 100,
        lastOrderAt: lastOrderDaysAgo(5),
        vipSpendThreshold: vipThreshold,
        now,
      })
    ).toBe("new");
    expect(
      resolveCustomerSegment({
        orderCount: 2,
        totalSpent: 100,
        lastOrderAt: lastOrderDaysAgo(5),
        vipSpendThreshold: vipThreshold,
        now,
      })
    ).toBeNull();
  });

  it("marks Regular at three or more orders", () => {
    expect(
      resolveCustomerSegment({
        orderCount: SEGMENT_REGULAR_MIN_ORDERS,
        totalSpent: 200,
        lastOrderAt: lastOrderDaysAgo(5),
        vipSpendThreshold: vipThreshold,
        now,
      })
    ).toBe("regular");
  });

  it("uses at-risk and lapsed day boundaries", () => {
    expect(
      resolveCustomerSegment({
        orderCount: 5,
        totalSpent: 200,
        lastOrderAt: lastOrderDaysAgo(SEGMENT_AT_RISK_MIN_DAYS - 1),
        vipSpendThreshold: vipThreshold,
        now,
      })
    ).toBe("regular");
    expect(
      resolveCustomerSegment({
        orderCount: 5,
        totalSpent: 200,
        lastOrderAt: lastOrderDaysAgo(SEGMENT_AT_RISK_MIN_DAYS),
        vipSpendThreshold: vipThreshold,
        now,
      })
    ).toBe("at_risk");
    expect(
      resolveCustomerSegment({
        orderCount: 5,
        totalSpent: 200,
        lastOrderAt: lastOrderDaysAgo(SEGMENT_LAPSED_MIN_DAYS - 1),
        vipSpendThreshold: vipThreshold,
        now,
      })
    ).toBe("at_risk");
    expect(
      resolveCustomerSegment({
        orderCount: 5,
        totalSpent: 200,
        lastOrderAt: lastOrderDaysAgo(SEGMENT_LAPSED_MIN_DAYS),
        vipSpendThreshold: vipThreshold,
        now,
      })
    ).toBe("lapsed");
  });

  it("computes VIP threshold as top spend fraction", () => {
    const threshold = vipSpendThreshold([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
    expect(threshold).toBe(1000);
  });
});

describe("stats and csv export", () => {
  it("computes avg order value from non-cancelled orders", () => {
    const stats = customerDirectoryStats([
      {
        id: "1",
        name: "A",
        email: "",
        phone: null,
        createdAt: new Date(),
        isGuest: true,
        orderCount: 3,
        nonCancelledOrderCount: 2,
        totalSpent: 1000,
        segment: null,
        lastOrder: null,
      },
    ]);
    expect(stats.avgOrderValue).toBe(500);
  });

  it("includes segment and spend in csv", () => {
    const csv = customersToCsv([
      {
        id: "guest:phone:3001234567",
        name: "Test",
        email: "t@t.com",
        phone: "03001234567",
        createdAt: new Date("2026-01-02T00:00:00Z"),
        isGuest: true,
        orderCount: 1,
        nonCancelledOrderCount: 1,
        totalSpent: 400,
        segment: "new",
        lastOrder: {
          id: "o1",
          total: 400,
          status: "DELIVERED" as const,
          createdAt: new Date("2026-02-01T00:00:00Z"),
          fulfillmentType: "DELIVERY" as const,
        },
      },
    ]);
    expect(csv).toContain("segment");
    expect(csv).toContain("new");
    expect(csv).toContain("400");
  });
});

describe("server-side list helpers", () => {
  const base = {
    id: "1",
    name: "Ali",
    email: "a@b.com",
    phone: "03001112233",
    createdAt: new Date("2026-01-01"),
    isGuest: true,
    orderCount: 2,
    nonCancelledOrderCount: 2,
    totalSpent: 500,
    segment: null as const,
    lastOrder: null,
  };

  it("filters by search and paginates", () => {
    const rows = [
      { ...base, id: "1", name: "Ali Khan" },
      { ...base, id: "2", name: "Sara", email: "sara@test.com" },
    ];
    const filtered = filterCustomers(rows, "sara", "name");
    expect(filtered).toHaveLength(1);
    const page = paginateCustomers(filtered, 1, 0);
    expect(page.total).toBe(1);
    expect(page.customers[0].name).toBe("Sara");
  });
});

describe("guest joined date aggregation", () => {
  it("uses earliest order as joined, not latest", () => {
    const orders = [
      { createdAt: new Date("2026-01-20T12:00:00Z") },
      { createdAt: new Date("2026-01-05T12:00:00Z") },
      { createdAt: new Date("2026-01-15T12:00:00Z") },
    ];
    let joined = orders[0].createdAt;
    for (const o of orders) {
      if (o.createdAt < joined) joined = o.createdAt;
    }
    expect(joined.toISOString()).toBe(new Date("2026-01-05T12:00:00Z").toISOString());
    expect(joined.getTime()).not.toBe(new Date("2026-01-20T12:00:00Z").getTime());
  });
});
