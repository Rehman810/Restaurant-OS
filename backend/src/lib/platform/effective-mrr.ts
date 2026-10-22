import { PlanInterval, SubscriptionStatus, type Plan, type Subscription } from "@prisma/client";

export function effectiveMonthlyPricePkr(plan: Pick<Plan, "pricePkr" | "interval">, discountPercent = 0) {
  const base = plan.pricePkr;
  const discounted = discountPercent > 0 ? Math.round(base * (1 - discountPercent / 100)) : base;
  if (plan.interval === PlanInterval.YEARLY) {
    return Math.round(discounted / 12);
  }
  return discounted;
}

export function subscriptionCountsForMrr(sub: Pick<Subscription, "status">) {
  return sub.status === SubscriptionStatus.ACTIVE;
}
