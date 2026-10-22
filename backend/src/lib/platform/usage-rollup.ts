import { STAFF_DIRECTORY_ROLES } from "../roles";
import { prisma } from "../prisma";
import { runWithRestaurant } from "../restaurant-context";
import { aggregatePeriodOrderMetrics } from "../metrics/period-stats";
import { karachiDayRangeUtc, karachiDateOnly } from "./karachi-time";

export async function rollupTenantUsageForDay(restaurantId: string, refDay: Date) {
  return runWithRestaurant(restaurantId, async () => {
    const { startUtc, endUtc } = karachiDayRangeUtc(refDay);
    const metrics = await aggregatePeriodOrderMetrics({}, startUtc, endUtc);
    const [activeStaff, menuCount, orderTotal, userCount] = await Promise.all([
      prisma.user.count({ where: { isActive: true, role: { in: STAFF_DIRECTORY_ROLES } } }),
      prisma.menuItem.count(),
      prisma.order.count(),
      prisma.user.count(),
    ]);
    const usageDate = karachiDateOnly(refDay);
    const rowEstimate = menuCount + orderTotal + userCount;
    return prisma.tenantUsageDaily.upsert({
      where: { restaurantId_usageDate: { restaurantId, usageDate } },
      create: {
        restaurantId,
        usageDate,
        ordersCount: metrics.ordersCount,
        bookedPkr: Math.round(metrics.booked),
        collectedPkr: Math.round(metrics.collected),
        activeStaff,
        loginCount: 0,
        rowEstimate,
      },
      update: {
        ordersCount: metrics.ordersCount,
        bookedPkr: Math.round(metrics.booked),
        collectedPkr: Math.round(metrics.collected),
        activeStaff,
        rowEstimate,
      },
    });
  });
}
