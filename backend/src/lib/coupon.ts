import { Coupon, CouponDiscountType, FulfillmentType, OrderStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { toMinorUnits } from "./money";

export function normalizeCouponCode(code: string) {
  return code.trim().toUpperCase();
}

export const BOOKED_COUPON_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING_CONFIRMATION,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.COLLECTED,
  OrderStatus.SERVED,
];

export type CouponChannel = "online" | "pos" | "dine_in";

export type CouponLike = Pick<
  Coupon,
  | "id"
  | "code"
  | "type"
  | "value"
  | "minSubtotal"
  | "maxSubtotal"
  | "maxDiscount"
  | "usageLimit"
  | "perCustomerLimit"
  | "firstOrderOnly"
  | "usedCount"
  | "startsAt"
  | "endsAt"
  | "scheduleDays"
  | "scheduleStartMinutes"
  | "scheduleEndMinutes"
  | "channelOnline"
  | "channelPos"
  | "channelDineIn"
  | "validDelivery"
  | "validPickup"
  | "validDineIn"
  | "isActive"
  | "branchId"
>;

export type CouponEvalContext = {
  subtotal: number;
  branchId?: string | null;
  channel?: CouponChannel;
  fulfillment?: FulfillmentType | string | null;
  priorOrderCount?: number;
  priorCouponUses?: number;
  customerId?: string | null;
  timezone?: string;
  now?: Date;
};

function clockInZone(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = dayMap[weekday.slice(0, 3)] ?? -1;
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return { day, minutes: hour * 60 + minute };
}

export function validateCouponWindow(coupon: CouponLike, now = new Date(), timezone = "Asia/Karachi") {
  if (!coupon.isActive) return "This promo code is not active.";
  if (coupon.startsAt && now < coupon.startsAt) return "This promo code is not valid yet.";
  if (coupon.endsAt && now > coupon.endsAt) return "This promo code has expired.";
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return "This promo code has reached its usage limit.";
  }
  if (
    (coupon.scheduleDays?.length ?? 0) > 0 &&
    coupon.scheduleStartMinutes != null &&
    coupon.scheduleEndMinutes != null
  ) {
    const { day, minutes } = clockInZone(now, timezone);
    if (!coupon.scheduleDays.includes(day)) {
      return "This promo code is not valid today.";
    }
    const start = coupon.scheduleStartMinutes;
    const end = coupon.scheduleEndMinutes;
    const inWindow = start <= end ? minutes >= start && minutes <= end : minutes >= start || minutes <= end;
    if (!inWindow) return "This promo code is not valid at this time.";
  }
  return null;
}

export function validateCouponAudience(coupon: CouponLike, ctx: CouponEvalContext = { subtotal: 0 }) {
  if (coupon.branchId && ctx.branchId && coupon.branchId !== ctx.branchId) {
    return "This promo code is not valid for your branch.";
  }
  if (ctx.channel === "online" && coupon.channelOnline === false) {
    return "This promo code cannot be used on online orders.";
  }
  if (ctx.channel === "pos" && coupon.channelPos === false) {
    return "This promo code cannot be used on POS orders.";
  }
  if (ctx.channel === "dine_in" && coupon.channelDineIn === false) {
    return "This promo code cannot be used on dine-in orders.";
  }
  const fulfillment = String(ctx.fulfillment || "").toUpperCase();
  if (fulfillment === "DELIVERY" && coupon.validDelivery === false) {
    return "This promo code is not valid on delivery orders.";
  }
  if (fulfillment === "PICKUP" && coupon.validPickup === false) {
    return "This promo code is not valid on pickup orders.";
  }
  if (fulfillment === "DINE_IN" && coupon.validDineIn === false) {
    return "This promo code is not valid on dine-in orders.";
  }
  if (coupon.firstOrderOnly) {
    if (!ctx.customerId) return "Sign in to use this first-order voucher.";
    if ((ctx.priorOrderCount ?? 0) > 0) return "This promo code is for first orders only.";
  }
  if (coupon.perCustomerLimit != null) {
    if (!ctx.customerId) return "Sign in to use this voucher.";
    if ((ctx.priorCouponUses ?? 0) >= coupon.perCustomerLimit) {
      return "You have already used this promo code the maximum number of times.";
    }
  }
  return null;
}

export function computeCouponDiscount(coupon: CouponLike, subtotal: number) {
  const subMinor = toMinorUnits(subtotal);
  const minMinor = toMinorUnits(Number(coupon.minSubtotal));
  if (subMinor < minMinor) {
    return {
      ok: false as const,
      error: `Minimum order for this code is Rs ${Number(coupon.minSubtotal)}.`,
    };
  }
  if (coupon.maxSubtotal != null) {
    const maxMinor = toMinorUnits(Number(coupon.maxSubtotal));
    if (subMinor > maxMinor) {
      return {
        ok: false as const,
        error: `This code is only valid on orders up to Rs ${Number(coupon.maxSubtotal)}.`,
      };
    }
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

export function evaluateCoupon(coupon: CouponLike, ctx: CouponEvalContext) {
  const windowErr = validateCouponWindow(coupon, ctx.now, ctx.timezone ?? "Asia/Karachi");
  if (windowErr) return { ok: false as const, error: windowErr };
  const audienceErr = validateCouponAudience(coupon, ctx);
  if (audienceErr) return { ok: false as const, error: audienceErr };
  return computeCouponDiscount(coupon, ctx.subtotal);
}

export async function couponCustomerStats(customerId: string | undefined, couponId: string) {
  if (!customerId) return { priorOrderCount: 0, priorCouponUses: 0 };
  const booked = { status: { in: BOOKED_COUPON_STATUSES } };
  const [priorOrderCount, priorCouponUses] = await Promise.all([
    prisma.order.count({ where: { customerId, ...booked } }),
    prisma.order.count({ where: { customerId, couponId, ...booked } }),
  ]);
  return { priorOrderCount, priorCouponUses };
}
