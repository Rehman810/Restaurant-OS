import { describe, expect, it } from "vitest";
import { CouponDiscountType } from "@prisma/client";
import { computeCouponDiscount, evaluateCoupon, validateCouponWindow } from "../src/lib/coupon";
import { loyaltyRedeemDiscount, pointsEarnedForTotal } from "../src/lib/loyalty";

const baseCoupon = {
  id: "c1",
  code: "SAVE10",
  type: CouponDiscountType.PERCENT,
  value: 10,
  minSubtotal: 0,
  maxSubtotal: null,
  maxDiscount: null,
  usageLimit: null,
  perCustomerLimit: null,
  firstOrderOnly: false,
  usedCount: 0,
  startsAt: null,
  endsAt: null,
  scheduleDays: [] as number[],
  scheduleStartMinutes: null,
  scheduleEndMinutes: null,
  channelOnline: true,
  channelPos: true,
  channelDineIn: true,
  validDelivery: true,
  validPickup: true,
  validDineIn: true,
  isActive: true,
  branchId: null,
};

describe("[CPN-01] coupons and loyalty", () => {
  it("computes percent discount", () => {
    const r = computeCouponDiscount(baseCoupon, 1000);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.discount).toBe(100);
  });

  it("rejects below minimum order", () => {
    const r = computeCouponDiscount({ ...baseCoupon, minSubtotal: 500 }, 200);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/minimum order/i);
  });

  it("rejects above maximum order", () => {
    const r = computeCouponDiscount({ ...baseCoupon, maxSubtotal: 1000 }, 1500);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/up to/i);
  });

  it("rejects first-order code for returning customers", () => {
    const r = evaluateCoupon(
      { ...baseCoupon, firstOrderOnly: true },
      { subtotal: 800, customerId: "u1", priorOrderCount: 2 }
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/first order/i);
  });

  it("rejects expired coupons", () => {
    const err = validateCouponWindow({
      ...baseCoupon,
      endsAt: new Date("2020-01-01"),
    });
    expect(err).toMatch(/expired/i);
  });

  it("caps loyalty redeem by percent", () => {
    const { points, discount } = loyaltyRedeemDiscount(500, 1000, 500, {
      loyaltyMaxRedeemPercent: 20,
      loyaltyRedeemPerPoint: 1,
    });
    expect(discount).toBeLessThanOrEqual(200);
    expect(points).toBeGreaterThan(0);
  });

  it("earns points from total", () => {
    expect(pointsEarnedForTotal(250, { loyaltyEarnPer100: 1 })).toBe(2);
  });
});
