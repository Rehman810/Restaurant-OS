import {
  PlatformInvoiceStatus,
  SubscriptionStatus,
  TenantStatus,
  Prisma,
} from "@prisma/client";
import { basePrisma } from "../prisma-base";
import { withoutTenant } from "../restaurant-context";
import { effectiveMonthlyPricePkr, subscriptionCountsForMrr } from "./effective-mrr";
import { addKarachiDays, karachiDateOnly } from "./karachi-time";
import { REAL_TENANT_FILTER } from "./real-tenants";
import { runWithRestaurant } from "../restaurant-context";
import { getOnboardingStatus } from "../onboarding";

export type OverviewRange = 7 | 30 | 90;

export function parseOverviewRange(raw: string | undefined): OverviewRange {
  const n = Number(String(raw || "30").replace(/d$/i, ""));
  if (n === 7 || n === 30 || n === 90) return n;
  return 30;
}

export async function loadGmvTrend(rangeDays: OverviewRange) {
  const now = new Date();
  const from = karachiDateOnly(addKarachiDays(now, -rangeDays + 1));
  const rows = await basePrisma.tenantUsageDaily.groupBy({
    by: ["usageDate"],
    where: { usageDate: { gte: from }, restaurant: REAL_TENANT_FILTER },
    _sum: { collectedPkr: true },
    orderBy: { usageDate: "asc" },
  });
  return rows.map((r) => ({
    date: r.usageDate.toISOString().slice(0, 10),
    collectedPkr: r._sum.collectedPkr ?? 0,
  }));
}

export async function loadMrrMovement(rangeDays: OverviewRange) {
  const since = addKarachiDays(new Date(), -rangeDays);
  const subs = await basePrisma.subscription.findMany({
    where: { restaurant: REAL_TENANT_FILTER },
    include: { plan: true, restaurant: { select: { createdAt: true } } },
  });

  let newPkr = 0;
  let churnPkr = 0;
  let expansionPkr = 0;
  let contractionPkr = 0;

  for (const sub of subs) {
    const mrr = subscriptionCountsForMrr(sub) ? effectiveMonthlyPricePkr(sub.plan) : 0;
    if (sub.status === SubscriptionStatus.ACTIVE && sub.updatedAt >= since && sub.createdAt >= since) {
      newPkr += mrr;
    }
    if (sub.status === SubscriptionStatus.CANCELLED && sub.cancelledAt && sub.cancelledAt >= since) {
      churnPkr += effectiveMonthlyPricePkr(sub.plan);
    }
  }

  const planChanges = await basePrisma.platformAuditLog.findMany({
    where: {
      action: "subscription.updated",
      createdAt: { gte: since },
      after: { not: Prisma.DbNull },
    },
    take: 500,
    orderBy: { createdAt: "desc" },
  });
  for (const row of planChanges) {
    const before = row.before as { planId?: string } | null;
    const after = row.after as { planId?: string } | null;
    if (!before?.planId || !after?.planId || before.planId === after.planId) continue;
    const [oldPlan, newPlan] = await Promise.all([
      basePrisma.plan.findUnique({ where: { id: before.planId } }),
      basePrisma.plan.findUnique({ where: { id: after.planId } }),
    ]);
    if (!oldPlan || !newPlan) continue;
    const delta = effectiveMonthlyPricePkr(newPlan) - effectiveMonthlyPricePkr(oldPlan);
    if (delta > 0) expansionPkr += delta;
    if (delta < 0) contractionPkr += Math.abs(delta);
  }

  return { newPkr, expansionPkr, contractionPkr, churnPkr, netPkr: newPkr + expansionPkr - contractionPkr - churnPkr };
}

export async function loadConversionMetrics(rangeDays: OverviewRange) {
  const since = addKarachiDays(new Date(), -rangeDays);
  const trialsStarted = await basePrisma.subscription.count({
    where: {
      restaurant: REAL_TENANT_FILTER,
      createdAt: { gte: since },
      status: { in: [SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELLED] },
    },
  });
  const converted = await basePrisma.subscription.count({
    where: {
      restaurant: REAL_TENANT_FILTER,
      status: SubscriptionStatus.ACTIVE,
      updatedAt: { gte: since },
      trialEndsAt: { not: null },
    },
  });
  const cancelled = await basePrisma.restaurant.count({
    where: { ...REAL_TENANT_FILTER, status: TenantStatus.CANCELLED, statusChangedAt: { gte: since } },
  });
  const active = await basePrisma.restaurant.count({
    where: { ...REAL_TENANT_FILTER, status: TenantStatus.ACTIVE },
  });
  const paidSubs = await basePrisma.subscription.findMany({
    where: { status: SubscriptionStatus.ACTIVE, restaurant: REAL_TENANT_FILTER },
    include: { plan: true },
  });
  let mrr = 0;
  for (const s of paidSubs) mrr += effectiveMonthlyPricePkr(s.plan);
  const payingTenants = paidSubs.length;
  const arpaPkr = payingTenants > 0 ? Math.round(mrr / payingTenants) : 0;
  const trialToPaidRate = trialsStarted > 0 ? converted / trialsStarted : 0;
  const churnRate = active > 0 ? cancelled / active : 0;
  return { trialToPaidRate, churnRate, arpaPkr, trialsStarted, converted };
}

export async function loadSignupFunnel(rangeDays: OverviewRange) {
  const since = addKarachiDays(new Date(), -rangeDays);
  const created = await basePrisma.restaurant.findMany({
    where: { ...REAL_TENANT_FILTER, createdAt: { gte: since } },
    select: { id: true, createdAt: true },
    take: 500,
  });
  let onboardingComplete = 0;
  let firstOrder = 0;
  let paid = 0;
  for (const row of created) {
    const onboarding = await runWithRestaurant(row.id, () => getOnboardingStatus());
    if (onboarding.complete) onboardingComplete++;
    const usage = await basePrisma.tenantUsageDaily.aggregate({
      where: { restaurantId: row.id, ordersCount: { gt: 0 } },
      _sum: { ordersCount: true },
    });
    if ((usage._sum.ordersCount ?? 0) > 0) firstOrder++;
    const inv = await basePrisma.platformInvoice.findFirst({
      where: { restaurantId: row.id, status: PlatformInvoiceStatus.PAID },
    });
    if (inv) paid++;
  }
  return {
    created: created.length,
    onboardingComplete,
    firstOrder,
    paid,
  };
}

export async function loadNeedsAttention() {
  const now = new Date();
  const items: Array<{
    id: string;
    kind: string;
    label: string;
    href: string;
    tenantId?: string;
    invoiceId?: string;
  }> = [];

  const overdue = await basePrisma.platformInvoice.findMany({
    where: {
      status: PlatformInvoiceStatus.OPEN,
      dueAt: { lt: now },
      restaurant: REAL_TENANT_FILTER,
    },
    include: { restaurant: { select: { id: true, displayName: true, slug: true } } },
    take: 15,
    orderBy: { dueAt: "asc" },
  });
  for (const inv of overdue) {
    items.push({
      id: `overdue-${inv.id}`,
      kind: "overdue_invoice",
      label: `${inv.restaurant.displayName || inv.restaurant.slug}: ${inv.invoiceNumber} overdue`,
      href: `/billing/invoices/${inv.id}`,
      tenantId: inv.restaurantId,
      invoiceId: inv.id,
    });
  }

  const trialsEnd = addKarachiDays(now, 7);
  const trials = await basePrisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.TRIALING,
      trialEndsAt: { lte: trialsEnd, gte: now },
      restaurant: REAL_TENANT_FILTER,
    },
    include: { restaurant: { select: { id: true, displayName: true, slug: true } } },
    take: 10,
  });
  for (const sub of trials) {
    items.push({
      id: `trial-${sub.restaurantId}`,
      kind: "trial_ending",
      label: `${sub.restaurant.displayName || sub.restaurant.slug}: trial ending soon`,
      href: `/tenants/${sub.restaurantId}`,
      tenantId: sub.restaurantId,
    });
  }

  return items;
}
