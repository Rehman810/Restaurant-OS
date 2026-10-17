import { Role } from "@prisma/client";
import type { DashboardSummary } from "./summary-types";

const FINANCIAL_ROLES: Role[] = [Role.ADMIN, Role.MANAGER];

export function canSeeFinancials(role: Role) {
  return FINANCIAL_ROLES.includes(role);
}

export function filterDashboardForRole(role: Role, summary: DashboardSummary): DashboardSummary {
  if (canSeeFinancials(role)) return summary;

  const ops: DashboardSummary = {
    ...summary,
    kpis: {
      ordersToday: summary.kpis.ordersToday,
      completedToday: summary.kpis.completedToday,
      cancelledToday: summary.kpis.cancelledToday,
      booked: null,
      collected: null,
      avgOrderValue: null,
    },
    sourceSplit: null,
    paymentSplit: null,
    hourlySales: summary.hourlySales
      ? {
          today: summary.hourlySales.today.map((h) => ({ hour: h.hour, orders: h.orders, revenue: null })),
          comparison: summary.hourlySales.comparison.map((h) => ({
            hour: h.hour,
            orders: h.orders,
            revenue: null,
          })),
          comparisonKind: summary.hourlySales.comparisonKind,
        }
      : null,
    last7Days: summary.last7Days?.map((d) => ({ ...d, revenue: null })) ?? null,
    topSellers: summary.topSellers,
    shifts: null,
    riderCash: null,
    controls: null,
    feedback: summary.feedback,
    riders: null,
  };
  return ops;
}
