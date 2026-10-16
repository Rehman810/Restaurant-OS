import { describe, expect, it } from "vitest";
import { CouponDiscountType } from "@prisma/client";
import { computeCouponDiscount, validateCouponWindow } from "../src/lib/coupon";
import { loyaltyRedeemDiscount, pointsEarnedForTotal } from "../src/lib/loyalty";

const baseCoupon = {
  id: "c1",
  code: "SAVE10",
  type: CouponDiscountType.PERCENT,
  value: 10,
  minSubtotal: 0,
  maxDiscount: null,
  usageLimit: null,
  usedCount: 0,
  startsAt: null,
  endsAt: null,
  isActive: true,
  branchId: null,
};

describe("[CPN-01] coupons and loyalty", () => {
  it("computes percent discount", () => {
    const r = computeCouponDiscount(baseCoupon, 1000);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.discount).toBe(100);
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
