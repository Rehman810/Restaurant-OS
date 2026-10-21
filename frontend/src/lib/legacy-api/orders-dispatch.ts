import { api } from "@/lib/api";
import type { AdminOrderRow, AdminOrdersListResponse } from "@/lib/admin-orders/types";
import type { FetchAdminOrdersParams } from "@/lib/admin-orders/api";
import type { Order, OrderStatus } from "@/lib/types";

type LegacyOrdersList = {
  orders: Order[];
  total: number;
  limit: number;
  offset: number;
  statusCounts: Record<string, number>;
  filteredTotal: number;
};

function num(v: string | number | undefined | null) {
  return Number(v ?? 0);
}

function mapLegacyOrder(o: Order): AdminOrderRow {
  const createdAt = o.createdAt || new Date().toISOString();
  const ageSeconds = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
  const lines = (o.items || []).slice(0, 2).map((it) => ({
    quantity: it.quantity,
    name: it.nameAtOrder,
    optionsLabel: it.optionsLabel || "",
  }));
  const extra = Math.max(0, (o.items?.length || 0) - lines.length);
  return {
    id: o.id,
    number: o.orderNumber,
    shortNumber: o.orderNumber.replace(/^ORD-/, "").slice(-4),
    shortDisplay: o.orderNumber,
    type: o.fulfillmentType || "DELIVERY",
    source: o.orderSource === "POS" ? "pos" : "online",
    status: o.status,
    nextActions: [],
    createdAt,
    statusChangedAt: createdAt,
    ageSeconds,
    isLate: false,
    isStale: false,
    customer: { name: o.customerName, phone: o.customerPhone },
    itemsSummary: {
      lines,
      extraCount: extra,
      totalItems: o.items?.reduce((s, i) => s + i.quantity, 0) || 0,
    },
    table: o.tableNumber || o.diningTable?.label || null,
    address: o.deliveryAddress
      ? { text: o.deliveryAddress, area: o.deliveryArea?.name || null }
      : null,
    rider: o.rider
      ? { id: o.rider.id, name: o.rider.name, assignedAt: null }
      : o.riderId
        ? { id: o.riderId, name: "Rider", assignedAt: null }
        : null,
    totals: {
      subtotal: num(o.subtotal),
      deliveryCharge: num(o.deliveryCharge),
      taxAmount: num(o.taxAmount),
      discountAmount: num(o.discountAmount),
      total: num(o.total),
    },
    payment: {
      status: o.paymentStatus === "PAID" ? "paid" : "unpaid",
      label: o.paymentStatus === "PAID" ? "Paid" : "Unpaid",
      methods: o.paymentMethod ? [o.paymentMethod.toLowerCase()] : [],
      amountDue: num(o.total),
      codAmount: null,
    },
    possibleDuplicateOf: null,
    print: { receiptPrinted: false, kotPrinted: false, kotPrintCount: 0 },
    notes: { hasNotes: Boolean(o.notes?.trim()), hasAllergyHint: false },
    isRush: false,
  };
}

export async function fetchAdminOrdersLegacy(params: FetchAdminOrdersParams): Promise<AdminOrdersListResponse> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;
  const qs = new URLSearchParams();
  qs.set("limit", String(pageSize));
  qs.set("offset", String((page - 1) * pageSize));
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.q?.trim()) qs.set("search", params.q.trim());
  if (params.statuses?.length === 1) qs.set("status", params.statuses[0]);

  const data = await api<LegacyOrdersList>(`/orders/?${qs.toString()}`);
  let rows = data.orders.map(mapLegacyOrder);
  if (params.statuses && params.statuses.length > 1) {
    const set = new Set(params.statuses);
    rows = rows.filter((r) => set.has(r.status));
  }

  const activeStatuses: OrderStatus[] = [
    "PENDING_CONFIRMATION",
    "CONFIRMED",
    "PREPARING",
    "READY",
    "OUT_FOR_DELIVERY",
  ];
  const active = activeStatuses.reduce((s, st) => s + (data.statusCounts[st] || 0), 0);

  return {
    rows,
    pagination: {
      page,
      pageSize,
      total: data.total,
      totalPages: Math.max(1, Math.ceil(data.total / pageSize)),
    },
    summary: {
      statusCounts: data.statusCounts,
      completedCount:
        (data.statusCounts.DELIVERED || 0) +
        (data.statusCounts.COLLECTED || 0) +
        (data.statusCounts.SERVED || 0),
      active,
      late: 0,
      stale: 0,
      unpaid: 0,
      booked: data.filteredTotal,
      bookedDefinition: "Filtered order total",
    },
    serverTime: new Date().toISOString(),
    timezone: "Asia/Karachi",
  };
}
