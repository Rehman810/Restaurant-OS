import { CouponDiscountType, Prisma } from "@prisma/client";
import { normalizeCouponCode } from "./coupon";

function asDate(value: unknown, endOfDay = false): Date | null {
  if (value == null || value === "") return null;
  const raw = String(value);
  if (raw.length <= 10) {
    return new Date(endOfDay ? `${raw}T23:59:59.999` : `${raw}T00:00:00`);
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function asInt(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function asMoney(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function asDays(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
}

export function couponWriteData(
  body: Record<string, unknown>,
  mode: "create" | "update"
): { data: Prisma.CouponUncheckedCreateInput } | { error: string } {
  const data: Prisma.CouponUncheckedCreateInput = {
    code: "X",
    type: CouponDiscountType.PERCENT,
    value: 1,
  };
  const patch: Prisma.CouponUncheckedUpdateInput = {};
  const target = mode === "create" ? data : patch;

  if (mode === "create" || typeof body.code === "string") {
    const code = normalizeCouponCode(String(body.code || ""));
    if (!code) return { error: "Code is required." };
    if (mode === "create") data.code = code;
    else patch.code = code;
  }

  if (mode === "create" || body.type != null) {
    const type = body.type as CouponDiscountType;
    if (!type || !Object.values(CouponDiscountType).includes(type)) {
      return { error: "Invalid discount type." };
    }
    if (mode === "create") data.type = type;
    else patch.type = type;
  }

  if (mode === "create" || body.value !== undefined) {
    const value = Number(body.value);
    if (!Number.isFinite(value) || value <= 0) {
      return { error: "Value must be greater than zero." };
    }
    if (mode === "create") data.value = value;
    else patch.value = value;
  }

  const minSubtotal = body.minSubtotal !== undefined ? Number(body.minSubtotal) || 0 : undefined;
  const maxSubtotal = body.maxSubtotal !== undefined ? asMoney(body.maxSubtotal) : undefined;
  if (minSubtotal != null && maxSubtotal != null && maxSubtotal < minSubtotal) {
    return { error: "Maximum order must be greater than the minimum order." };
  }

  if (typeof body.name === "string") target.name = body.name.trim();
  if (typeof body.description === "string") target.description = body.description.trim();
  if (minSubtotal !== undefined) target.minSubtotal = minSubtotal;
  if (body.maxSubtotal !== undefined) target.maxSubtotal = maxSubtotal;
  if (body.maxDiscount !== undefined) target.maxDiscount = asMoney(body.maxDiscount);
  if (body.usageLimit !== undefined) target.usageLimit = asInt(body.usageLimit);
  if (body.perCustomerLimit !== undefined) target.perCustomerLimit = asInt(body.perCustomerLimit);
  if (body.firstOrderOnly != null) target.firstOrderOnly = Boolean(body.firstOrderOnly);
  if (body.startsAt !== undefined) target.startsAt = asDate(body.startsAt, false);
  if (body.endsAt !== undefined) target.endsAt = asDate(body.endsAt, true);
  if (body.scheduleDays !== undefined) target.scheduleDays = asDays(body.scheduleDays);
  if (body.scheduleStartMinutes !== undefined) {
    target.scheduleStartMinutes =
      body.scheduleStartMinutes === null || body.scheduleStartMinutes === ""
        ? null
        : Number(body.scheduleStartMinutes);
  }
  if (body.scheduleEndMinutes !== undefined) {
    target.scheduleEndMinutes =
      body.scheduleEndMinutes === null || body.scheduleEndMinutes === ""
        ? null
        : Number(body.scheduleEndMinutes);
  }
  if (body.channelOnline != null) target.channelOnline = Boolean(body.channelOnline);
  if (body.channelPos != null) target.channelPos = Boolean(body.channelPos);
  if (body.channelDineIn != null) target.channelDineIn = Boolean(body.channelDineIn);
  if (body.validDelivery != null) target.validDelivery = Boolean(body.validDelivery);
  if (body.validPickup != null) target.validPickup = Boolean(body.validPickup);
  if (body.validDineIn != null) target.validDineIn = Boolean(body.validDineIn);
  if (body.isActive != null) target.isActive = Boolean(body.isActive);

  if (mode === "create") {
    data.minSubtotal = minSubtotal ?? 0;
    data.firstOrderOnly = Boolean(body.firstOrderOnly);
    data.channelOnline = body.channelOnline !== false;
    data.channelPos = body.channelPos !== false;
    data.channelDineIn = body.channelDineIn !== false;
    data.validDelivery = body.validDelivery !== false;
    data.validPickup = body.validPickup !== false;
    data.validDineIn = body.validDineIn !== false;
    data.isActive = body.isActive !== false;
  }

  if (mode === "create") return { data };
  return { data: patch as Prisma.CouponUncheckedCreateInput };
}
