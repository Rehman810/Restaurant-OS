import { Role } from "@prisma/client";
import type { AnalyticsOverview } from "./types";

const FINANCIAL: Role[] = [Role.ADMIN, Role.MANAGER];

export function filterAnalyticsForRole(role: Role, data: AnalyticsOverview): AnalyticsOverview {
  if (FINANCIAL.includes(role)) return data;

  return {
    ...data,
    kpis: {
      ordersCount: data.kpis.ordersCount,
      completedCount: data.kpis.completedCount,
      cancelledCount: data.kpis.cancelledCount,
      uniqueCustomers: data.kpis.uniqueCustomers,
      newCustomers: data.kpis.newCustomers,
      returningCustomers: data.kpis.returningCustomers,
      booked: null,
      collected: null,
      avgOrderValue: null,
      discountsTotal: null,
      refundsTotal: null,
    },
    channels: null,
    payments: null,
    items: null,
    categories: null,
    attachRate: null,
    customers: data.customers
      ? {
          ...data.customers,
          topCustomers: data.customers.topCustomers.map((c) => ({
            ...c,
            phone: maskPhone(c.phone, role),
          })),
        }
      : null,
    promotions: null,
    control: null,
    profit: null,
    series: data.series
      ? {
          ...data.series,
          buckets: data.series.buckets.map((b) => ({
            ...b,
            booked: null,
            collected: null,
            comparisonBooked: null,
            comparisonCollected: null,
          })),
        }
      : null,
    heatmap: data.heatmap
      ? {
          ...data.heatmap,
          revenue: null,
        }
      : null,
  };
}

export function maskPhone(phone: string | null, role: Role) {
  if (!phone) return "";
  if (role === Role.ADMIN) return phone;
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 3) return "***";
  return `***${digits.slice(-3)}`;
}
