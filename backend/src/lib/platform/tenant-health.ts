import { SubscriptionStatus, TenantStatus } from "@prisma/client";
import { basePrisma } from "../prisma-base";
import { withoutTenant } from "../restaurant-context";
import { getOnboardingStatus } from "../onboarding";
import { runWithRestaurant } from "../restaurant-context";
import { addKarachiDays, karachiDateOnly } from "./karachi-time";

export type HealthFactor = { id: string; impact: number; label: string };

export async function computeTenantHealthScore(restaurantId: string) {
  return runWithRestaurant(restaurantId, async () => {
    const factors: HealthFactor[] = [];
    let score = 100;

    const restaurant = await basePrisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { status: true },
    });
    const subscription = await basePrisma.subscription.findUnique({
      where: { restaurantId },
      select: { status: true },
    });

    const since14 = karachiDateOnly(addKarachiDays(new Date(), -14));
    const usage = await basePrisma.tenantUsageDaily.aggregate({
      where: { restaurantId, usageDate: { gte: since14 } },
      _sum: { ordersCount: true },
    });
    const orders14 = usage._sum.ordersCount ?? 0;
    if (orders14 === 0 && restaurant?.status === TenantStatus.ACTIVE) {
      score -= 25;
      factors.push({ id: "no_recent_orders", impact: -25, label: "No orders in the last 14 days" });
    } else if (orders14 > 0) {
      factors.push({ id: "recent_orders", impact: 0, label: `${orders14} orders in the last 14 days` });
    }

    if (subscription?.status === SubscriptionStatus.PAST_DUE) {
      score -= 20;
      factors.push({ id: "past_due", impact: -20, label: "Subscription payment is past due" });
    }
    if (restaurant?.status === TenantStatus.SUSPENDED) {
      score -= 30;
      factors.push({ id: "suspended", impact: -30, label: "Store is suspended" });
    }

    const onboarding = await getOnboardingStatus();
    if (!onboarding.complete) {
      score -= 15;
      factors.push({ id: "onboarding", impact: -15, label: "Onboarding checklist incomplete" });
    }

    const clamped = Math.max(0, Math.min(100, score));
    return { score: clamped, factors };
  });
}

export async function countStuckOnboardingTenants() {
  const trials = await withoutTenant("stuck onboarding", () =>
    basePrisma.restaurant.findMany({
      where: { status: { in: [TenantStatus.TRIAL, TenantStatus.LEAD] } },
      select: { id: true },
      take: 500,
    })
  );
  let stuck = 0;
  for (const row of trials) {
    const status = await runWithRestaurant(row.id, () => getOnboardingStatus());
    if (!status.complete) stuck++;
  }
  return stuck;
}
