import { Coupon, CouponDiscountType } from "@prisma/client";
import { toMinorUnits } from "./money";

export function normalizeCouponCode(code: string) {
  return code.trim().toUpperCase();
}

export type CouponLike = Pick<
  Coupon,
  | "id"
  | "code"
  | "type"
  | "value"
  | "minSubtotal"
  | "maxDiscount"
  | "usageLimit"
  | "usedCount"
  | "startsAt"
  | "endsAt"
  | "isActive"
  | "branchId"
>;

export function validateCouponWindow(coupon: CouponLike, now = new Date()) {
  if (!coupon.isActive) return "This promo code is not active.";
  if (coupon.startsAt && now < coupon.startsAt) return "This promo code is not valid yet.";
  if (coupon.endsAt && now > coupon.endsAt) return "This promo code has expired.";
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return "This promo code has reached its usage limit.";
  }
  return null;
}

export function computeCouponDiscount(coupon: CouponLike, subtotal: number) {
  const subMinor = toMinorUnits(subtotal);
  const minMinor = toMinorUnits(Number(coupon.minSubtotal));
  if (subMinor < minMinor) {
    return {
      ok: false as const,
      error: `Minimum order for this code is ${Number(coupon.minSubtotal)}.`,
    };
  }
  let discountMinor = 0;
  if (coupon.type === CouponDiscountType.PERCENT) {
    discountMinor = Math.round((subMinor * Number(coupon.value)) / 100);
    if (coupon.maxDiscount != null) {
      discountMinor = Math.min(discountMinor, toMinorUnits(Number(coupon.maxDiscount)));
    }
  } else {
    discountMinor = toMinorUnits(Number(coupon.value));
  }
  discountMinor = Math.min(discountMinor, subMinor);
  return { ok: true as const, discount: discountMinor / 100, couponId: coupon.id, code: coupon.code };
}
