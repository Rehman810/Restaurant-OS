import { FulfillmentType, OrderStatus, Role } from "@prisma/client";
import { prisma } from "../prisma";
import type { BranchScope } from "../branch-scope";
import { deriveShortOrderNumber } from "../order-number";
import { deriveOrderPayment } from "./payment";
import { loadDuplicateMapBatched } from "./duplicates";
import { nextActionsForRole } from "./next-actions";
import {
  buildAdminOrdersWhere,
  parseAdminOrdersQuery,
  rowMatchesPaymentFilters,
  riderScopeUserId,
  type ParsedAdminOrdersQuery,
} from "./query";
import {
  computeAgeSeconds,
  computeIsLate,
  computeIsStale,
  statusChangedAtFromEvents,
} from "./timing";
import {
  canSeeCustomerPhone,
  canSeePayment,
  filterNextActionsForRole,
  maskPhoneForRole,
} from "./role-filter";
import { sortIncomingPipelineOrders } from "../dashboard/order-completion";
import { buildAdminOrdersSummary } from "./summary";
import { utcRangeForStoreDateKey } from "../dashboard/dates";
import type { Request } from "express";
import type { AuthUser } from "../../middleware/auth";

const listInclude = {
  items: {
    select: {
      menuItemId: true,
      quantity: true,
      nameAtOrder: true,
      optionsLabel: true,
    },
    take: 20,
  },
  rider: { select: { id: true, name: true } },
  diningTable: { select: { id: true, label: true } },
  deliveryArea: { select: { id: true, name: true } },
  payments: { select: { method: true, amount: true }, orderBy: { sortOrder: "asc" as const } },
  invoice: { select: { id: true } },
  events: {
    orderBy: { createdAt: "asc" as const },
    select: { toStatus: true, createdAt: true },
  },
};

type ListOrder = Awaited<
  ReturnType<
    typeof prisma.order.findMany<{
      include: typeof listInclude;
    }>
  >
>[number];

function itemsSummary(items: ListOrder["items"]) {
  const lines = items.slice(0, 2).map((i) => ({
    quantity: i.quantity,
    name: i.nameAtOrder,
    optionsLabel: i.optionsLabel || "",
  }));
  const extraCount = Math.max(0, items.length - 2);
  return { lines, extraCount, totalItems: items.reduce((s, i) => s + i.quantity, 0) };
}

function mapRow(
  order: ListOrder,
  role: Role,
  thresholds: {
    lateConfirmMinutes: number;
    latePrepMinutes: number;
    lateDeliveryMinutes: number;
    ordersStaleHours: number;
  },
  duplicateOf: string | null,
  now: Date
) {
  const { shortNumber, shortDisplay, fullNumber } = deriveShortOrderNumber(order.orderNumber);
  const statusChangedAt = statusChangedAtFromEvents(order.events, order.status, order.updatedAt);
  const ageSeconds = computeAgeSeconds(statusChangedAt, now);
  const minutesInStatus = Math.floor(ageSeconds / 60);
  const isLate = computeIsLate(order.status, minutesInStatus, thresholds);
  const isStale = computeIsStale(statusChangedAt, order.status, thresholds.ordersStaleHours, now);

  const paymentRow = {
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    total: Number(order.total),
    fulfillmentType: order.fulfillmentType,
    status: order.status,
    payments: order.payments.map((p) => ({
      method: p.method,
      amount: Number(p.amount),
    })),
  };
  const payment = canSeePayment(role) ? deriveOrderPayment(paymentRow) : null;

  const outForDeliveryAt = order.events.find((e) => e.toStatus === OrderStatus.OUT_FOR_DELIVERY)?.createdAt;

  const nextActions = filterNextActionsForRole(
    nextActionsForRole(role, order.status, order.fulfillmentType),
    role
  );

  return {
    id: order.id,
    number: fullNumber,
    shortNumber,
    shortDisplay,
    type: order.fulfillmentType,
    source: order.orderSource === "POS" ? "pos" : "online",
    status: order.status,
    nextActions,
    createdAt: order.createdAt.toISOString(),
    statusChangedAt: statusChangedAt.toISOString(),
    ageSeconds,
    isLate,
    isStale,
    customer: {
      name: order.customerName,
      phone: canSeeCustomerPhone(role) ? order.customerPhone : maskPhoneForRole(order.customerPhone, role),
      phoneMasked: !canSeeCustomerPhone(role),
    },
    itemsSummary: itemsSummary(order.items),
    table:
      order.fulfillmentType === FulfillmentType.DINE_IN
        ? order.diningTable?.label || order.tableNumber || null
        : null,
    address:
      order.fulfillmentType === FulfillmentType.DELIVERY
        ? {
            text: order.deliveryAddress,
            area: order.deliveryArea?.name ?? null,
          }
        : null,
    rider:
      order.fulfillmentType === FulfillmentType.DELIVERY && order.rider
        ? {
            id: order.rider.id,
            name: order.rider.name,
            assignedAt: outForDeliveryAt?.toISOString() ?? null,
          }
        : null,
    totals: {
      subtotal: Number(order.subtotal),
      deliveryCharge: Number(order.deliveryCharge),
      taxAmount: Number(order.taxAmount),
      discountAmount: Number(order.discountAmount),
      total: Number(order.total),
    },
    payment,
    possibleDuplicateOf: duplicateOf,
    print: {
      receiptPrinted: Boolean(order.invoice),
      kotPrinted: Boolean(order.kotPrintedAt),
      kotPrintCount: order.kotPrintCount ?? 0,
    },
    notes: {
      hasNotes: Boolean(order.notes?.trim()),
      hasAllergyHint: Boolean(order.notes?.match(/allerg/i)),
    },
    isRush: order.isRush,
  };
}

export async function listAdminOrders(
  req: Request,
  scope: BranchScope,
  user: AuthUser,
  timeZone: string,
  settings: {
    lateConfirmMinutes: number;
    latePrepMinutes: number;
    lateDeliveryMinutes: number;
    ordersStaleHours: number;
    duplicateOrderWindowMinutes: number;
  }
) {
  const query = parseAdminOrdersQuery(req);
  const riderId = riderScopeUserId(user.role, user.id);
  const where = buildAdminOrdersWhere(scope, query, timeZone, riderId);

  const rangeStart =
    query.from && /^\d{4}-\d{2}-\d{2}$/.test(query.from)
      ? utcRangeForStoreDateKey(query.from, timeZone).startUtc
      : undefined;
  const rangeEnd =
    query.to && /^\d{4}-\d{2}-\d{2}$/.test(query.to)
      ? utcRangeForStoreDateKey(query.to, timeZone).endUtc
      : undefined;

  const thresholds = {
    lateConfirmMinutes: settings.lateConfirmMinutes,
    latePrepMinutes: settings.latePrepMinutes,
    lateDeliveryMinutes: settings.lateDeliveryMinutes,
    ordersStaleHours: settings.ordersStaleHours,
  };

  const summary = await buildAdminOrdersSummary(
    where,
    scope.where,
    rangeStart,
    rangeEnd,
    thresholds
  );

  const needsPaymentFilter = query.paymentFilters.length > 0;
  const sortLate = query.sort === "lateFirst";

  let orders: ListOrder[];
  let total: number;

  if (needsPaymentFilter || sortLate) {
    const all = await prisma.order.findMany({
      where,
      include: listInclude,
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    const filtered = all.filter((o) =>
      rowMatchesPaymentFilters(
        {
          paymentStatus: o.paymentStatus,
          paymentMethod: o.paymentMethod,
          total: Number(o.total),
          fulfillmentType: o.fulfillmentType,
          status: o.status,
          payments: o.payments.map((p) => ({
            method: p.method,
            amount: Number(p.amount),
          })),
        },
        query.paymentFilters
      )
    );

    if (sortLate) {
      const now = Date.now();
      const rows = filtered.map((o) => {
        const statusChangedAt = statusChangedAtFromEvents(o.events, o.status, o.updatedAt);
        const minutesInStatus = Math.floor((now - statusChangedAt.getTime()) / 60_000);
        return { order: o, status: o.status, minutesInStatus, updatedAt: statusChangedAt };
      });
      sortIncomingPipelineOrders(rows, thresholds);
      filtered.splice(0, filtered.length, ...rows.map((r) => r.order));
    } else if (query.sort === "oldest") {
      filtered.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    } else if (query.sort === "total") {
      filtered.sort((a, b) => Number(b.total) - Number(a.total));
    }

    total = filtered.length;
    const start = (query.page - 1) * query.pageSize;
    orders = filtered.slice(start, start + query.pageSize);
  } else {
    total = await prisma.order.count({ where });
    const orderBy =
      query.sort === "oldest"
        ? { createdAt: "asc" as const }
        : query.sort === "total"
          ? { total: "desc" as const }
          : { createdAt: "desc" as const };

    orders = await prisma.order.findMany({
      where,
      include: listInclude,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
  }

  const dupMap = await loadDuplicateMapBatched(
    orders.map((o) => ({
      id: o.id,
      createdAt: o.createdAt,
      customerPhone: o.customerPhone,
      items: o.items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
    })),
    scope.where,
    settings.duplicateOrderWindowMinutes
  );

  const now = new Date();
  const rows = orders.map((o) => mapRow(o, user.role, thresholds, dupMap.get(o.id) ?? null, now));

  return {
    rows,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
    summary,
    serverTime: now.toISOString(),
    timezone: timeZone,
  };
}
