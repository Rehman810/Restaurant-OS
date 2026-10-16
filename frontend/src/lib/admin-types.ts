import { FulfillmentType, Order, OrderStatus } from "./types";

export type Rider = {
  id: string;
  name: string;
  phone?: string | null;
  activeDeliveries?: number;
  completedToday?: number;
};

export type AdminStats = {
  todayOrders: number;
  todayRevenue: number;
  monthOrders: number;
  monthRevenue: number;
  monthAvgOrderValue: number;
  avgOrderValue: number;
  awaitingConfirmation: number;
  pending: number;
  preparing: number;
  outForDelivery: number;
  deliveredToday: number;
  cancelledToday: number;
  menuCount: number;
  customerCount: number;
  totalOrders: number;
  totalRevenue: number;
  riders: Rider[];
  chart: { date: string; label: string; orders: number; revenue: number }[];
  topItems: { name: string; qty: number; revenue: number }[];
  categoryBreakdown: { category: string; revenue: number; orders: number }[];
  statusBreakdown: Partial<Record<OrderStatus, number>>;
  recentOrders: Order[];
  posTodayOrders: number;
  posTodayRevenue: number;
  riderCashPendingTotal?: number;
  riderCashPendingCount?: number;
  riderCashStaleCount?: number;
};

export type RiderCashLedgerEntry = {
  id: string;
  status: "PENDING" | "SETTLED";
  expectedAmount: number | string;
  collectedAmount: number | string;
  varianceReason: string | null;
  deliveredAt: string;
  settledAt: string | null;
  rider: { id: string; name: string; phone: string | null };
  order: { orderNumber: string; customerName: string; total: number | string };
  settlement: { id: string; createdAt: string; receivedTotal: number | string } | null;
};

export type RiderCashSummary = {
  totalPending: number;
  pendingCount: number;
  staleCount: number;
  staleHours: number;
  riders: { riderId: string; name: string; pendingAmount: number; count: number }[];
};

export type AnalyticsPeriod = "today" | "week" | "month" | "year";

export type AnalyticsData = {
  period: AnalyticsPeriod;
  periodLabel: string;
  range: { from: string; to: string };
  revenue: number;
  orders: number;
  avgOrderValue: number;
  delivered: number;
  customers: number;
  chart: { date: string; label: string; orders: number; revenue: number }[];
  topItems: { name: string; qty: number; revenue: number }[];
  categoryBreakdown: { category: string; revenue: number; orders: number }[];
  statusBreakdown: Partial<Record<OrderStatus, number>>;
};

export type AdminCustomer = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  createdAt: string;
  isGuest?: boolean;
  orderCount: number;
  totalSpent: number;
  lastOrder: { id: string; total: string | number; status: OrderStatus; createdAt: string; fulfillmentType?: FulfillmentType } | null;
};

export type AdminRider = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  activeOrders: Order[];
  deliveredCount: number;
  totalAssigned: number;
};
