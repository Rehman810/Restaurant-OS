/** Customers with exactly this many orders count as "New". */
export const SEGMENT_NEW_ORDER_COUNT = 1;

/** Minimum completed order count for "Regular". */
export const SEGMENT_REGULAR_MIN_ORDERS = 3;

/** Top fraction of spenders treated as VIP (0.1 = top 10%). */
export const SEGMENT_VIP_TOP_FRACTION = 0.1;

/** Days since last order before "At risk" (inclusive). */
export const SEGMENT_AT_RISK_MIN_DAYS = 30;

/** Days since last order before "Lapsed" (inclusive). */
export const SEGMENT_LAPSED_MIN_DAYS = 60;

export type CustomerSegment = "new" | "regular" | "vip" | "at_risk" | "lapsed";

export function daysSinceLastOrder(lastOrderAt: Date | null, now = new Date()): number | null {
  if (!lastOrderAt) return null;
  const ms = now.getTime() - lastOrderAt.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export function vipSpendThreshold(spendValues: number[]): number {
  const spends = spendValues.filter((n) => n > 0).sort((a, b) => a - b);
  if (!spends.length) return Infinity;
  const topCount = Math.max(1, Math.ceil(spends.length * SEGMENT_VIP_TOP_FRACTION));
  const cutoffIndex = Math.max(0, spends.length - topCount);
  return spends[cutoffIndex];
}

export function resolveCustomerSegment(input: {
  orderCount: number;
  totalSpent: number;
  lastOrderAt: Date | null;
  vipSpendThreshold: number;
  now?: Date;
}): CustomerSegment | null {
  const days = daysSinceLastOrder(input.lastOrderAt, input.now);
  if (days !== null && days >= SEGMENT_LAPSED_MIN_DAYS) return "lapsed";
  if (days !== null && days >= SEGMENT_AT_RISK_MIN_DAYS) return "at_risk";
  if (input.totalSpent > 0 && input.totalSpent >= input.vipSpendThreshold) return "vip";
  if (input.orderCount >= SEGMENT_REGULAR_MIN_ORDERS) return "regular";
  if (input.orderCount === SEGMENT_NEW_ORDER_COUNT) return "new";
  return null;
}
