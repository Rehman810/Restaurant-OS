import { PlatformInvoiceStatus } from "@prisma/client";
import { basePrisma } from "../prisma-base";
import { buildSubscriptionTimeline } from "./subscription-timeline";
import { ensureSubscriptionSynced } from "./subscription-lifecycle";

export async function loadSubscriptionTimelineForRestaurant(restaurantId: string, sync = true) {
  if (sync) {
    await ensureSubscriptionSynced(restaurantId);
  }
  const restaurant = await basePrisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { status: true, statusReason: true },
  });
  const subscription = await basePrisma.subscription.findUnique({
    where: { restaurantId },
    include: { plan: { select: { interval: true } } },
  });
  if (!restaurant || !subscription) return null;
  const openInvoice = await basePrisma.platformInvoice.findFirst({
    where: { restaurantId, status: PlatformInvoiceStatus.OPEN },
    orderBy: { dueAt: "asc" },
    select: { dueAt: true },
  });
  const timeline = buildSubscriptionTimeline({
    subscriptionStatus: subscription.status,
    tenantStatus: restaurant.status,
    planInterval: subscription.plan.interval,
    trialEndsAt: subscription.trialEndsAt,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    subscriptionCreatedAt: subscription.createdAt,
    hasOpenInvoice: Boolean(openInvoice),
    openInvoiceDueAt: openInvoice?.dueAt ?? null,
  });
  return {
    timeline,
    tenant: { status: restaurant.status, statusReason: restaurant.statusReason },
    subscription: {
      status: subscription.status,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
    },
  };
}
