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
import { loadJobRuns } from "./job-runs";
import { countStuckOnboardingTenants } from "./tenant-health";
import { unscopedQueryRaw } from "../tenant-sql";

export async function loadPlatformOverview() {
  return withoutTenant("platform overview", async () => {
    const now = new Date();
    const today = karachiDateOnly(now);
    const day7 = karachiDateOnly(addKarachiDays(now, -7));
    const day30 = karachiDateOnly(addKarachiDays(now, -30));
    const trialsEnd = addKarachiDays(now, 7);

    const statusCounts = await basePrisma.restaurant.groupBy({
      by: ["status"],
      _count: { _all: true },
    });

    const subscriptions = await basePrisma.subscription.findMany({
      include: { plan: true },
    });
    let mrrPkr = 0;
    for (const sub of subscriptions) {
      if (!subscriptionCountsForMrr(sub)) continue;
      mrrPkr += effectiveMonthlyPricePkr(sub.plan);
    }
    const arrPkr = mrrPkr * 12;

    const trialsEnding = await basePrisma.subscription.count({
      where: {
        status: SubscriptionStatus.TRIALING,
        trialEndsAt: { lte: trialsEnd, gte: now },
      },
    });

    const overdueInvoices = await basePrisma.platformInvoice.findMany({
      where: { status: PlatformInvoiceStatus.OPEN, dueAt: { lt: now } },
      select: { amountPkr: true },
    });
    const overdueAmountPkr = overdueInvoices.reduce((s, i) => s + i.amountPkr, 0);

    const gmvToday = await basePrisma.tenantUsageDaily.aggregate({
      where: { usageDate: today },
      _sum: { collectedPkr: true, ordersCount: true },
    });
    const gmv7 = await basePrisma.tenantUsageDaily.aggregate({
      where: { usageDate: { gte: day7 } },
      _sum: { collectedPkr: true },
    });
    const gmv30 = await basePrisma.tenantUsageDaily.aggregate({
      where: { usageDate: { gte: day30 } },
      _sum: { collectedPkr: true },
    });

    const activeTenantRows = await basePrisma.tenantUsageDaily.groupBy({
      by: ["restaurantId"],
      where: { usageDate: { gte: day7 }, ordersCount: { gt: 0 } },
      _sum: { ordersCount: true, collectedPkr: true },
    });

    const topByOrders = [...activeTenantRows]
      .sort((a, b) => (b._sum.ordersCount ?? 0) - (a._sum.ordersCount ?? 0))
      .slice(0, 10);
    const topByGmv = [...activeTenantRows]
      .sort((a, b) => (b._sum.collectedPkr ?? 0) - (a._sum.collectedPkr ?? 0))
      .slice(0, 10);

    const tenantNames = await basePrisma.restaurant.findMany({
      where: { id: { in: topByOrders.map((t) => t.restaurantId) } },
      select: { id: true, displayName: true, slug: true },
    });
    const nameById = new Map(tenantNames.map((t) => [t.id, t]));

    const cancelled30 = await basePrisma.restaurant.count({
      where: {
        status: TenantStatus.CANCELLED,
        statusChangedAt: { gte: addKarachiDays(now, -30) },
      },
    });
    const activeCount = await basePrisma.restaurant.count({
      where: { status: TenantStatus.ACTIVE },
    });
    const churnRate30 = activeCount > 0 ? cancelled30 / activeCount : 0;

    const atRisk = await basePrisma.restaurant.findMany({
      where: { status: TenantStatus.ACTIVE },
      select: { id: true, displayName: true, slug: true },
      take: 500,
    });
    const atRiskIds: Array<{ id: string; displayName: string; slug: string; reason: string }> = [];
    for (const tenant of atRisk) {
      const recent = await basePrisma.tenantUsageDaily.aggregate({
        where: { restaurantId: tenant.id, usageDate: { gte: day14(now) } },
        _sum: { ordersCount: true },
      });
      if ((recent._sum.ordersCount ?? 0) === 0) {
        atRiskIds.push({ ...tenant, reason: "No orders in 14 days" });
      }
    }

    const stuckOnboarding = await countStuckOnboardingTenants();

    const dbSize = await unscopedQueryRaw<Array<{ bytes: string }>>(
      "database size",
      Prisma.sql`SELECT pg_database_size(current_database())::text AS bytes`
    );

    const schedulers = await loadJobRuns();

    return {
      generatedAt: now.toISOString(),
      timezone: "Asia/Karachi",
      tenantsByStatus: statusCounts.map((row) => ({ status: row.status, count: row._count._all })),
      mrrPkr,
      arrPkr,
      trialsEndingIn7Days: trialsEnding,
      churn: { cancelledLast30Days: cancelled30, rate: churnRate30 },
      overdue: { count: overdueInvoices.length, amountPkr: overdueAmountPkr },
      gmv: {
        todayPkr: gmvToday._sum.collectedPkr ?? 0,
        last7DaysPkr: gmv7._sum.collectedPkr ?? 0,
        last30DaysPkr: gmv30._sum.collectedPkr ?? 0,
        ordersToday: gmvToday._sum.ordersCount ?? 0,
      },
      activeTenants7d: activeTenantRows.length,
      topTenantsByOrders: topByOrders.map((row) => ({
        restaurantId: row.restaurantId,
        name: nameById.get(row.restaurantId)?.displayName ?? "",
        slug: nameById.get(row.restaurantId)?.slug ?? "",
        orders: row._sum.ordersCount ?? 0,
      })),
      topTenantsByGmv: topByGmv.map((row) => ({
        restaurantId: row.restaurantId,
        name: nameById.get(row.restaurantId)?.displayName ?? "",
        slug: nameById.get(row.restaurantId)?.slug ?? "",
        collectedPkr: row._sum.collectedPkr ?? 0,
      })),
      atRiskTenants: atRiskIds.slice(0, 20),
      stuckOnboarding,
      schedulers,
      databaseBytes: Number(dbSize[0]?.bytes ?? 0),
    };
  });
}

function day14(now: Date) {
  return karachiDateOnly(addKarachiDays(now, -14));
}
