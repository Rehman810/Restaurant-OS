import { FulfillmentType, OrderStatus, Prisma, Role } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../prisma";
import type { BranchScope } from "../branch-scope";
import { deriveShortOrderNumber } from "../order-number";
import { orderBelongsInColumn, TRACKING_BOARD_COLUMNS } from "./board-columns";
import { deriveOrderPayment } from "./payment";
import {
  computeAgeSeconds,
  computeIsLate,
  computeIsStale,
  statusChangedAtFromEvents,
} from "./timing";
import { primaryNextAction } from "./next-actions";
import {
  canSeeCustomerPhone,
  canSeePayment,
  filterNextActionsForRole,
  maskPhoneForRole,
} from "./role-filter";
import { sortIncomingPipelineOrders } from "../dashboard/order-completion";
import {
  COMPLETED_STATUSES,
  PIPELINE_STATUSES,
  computeTrackingBoardSummaryFromOrders,
} from "../metrics/tracking-board";
import { storeDateKey, utcRangeForStoreDateKey } from "../dashboard/dates";
import { riderScopeUserId } from "./query";
import type { AuthUser } from "../../middleware/auth";
import { loadDuplicateMapBatched } from "./duplicates";

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
  events: {
    orderBy: { createdAt: "asc" as const },
    select: { toStatus: true, createdAt: true, reason: true },
  },
};

type BoardOrder = Prisma.OrderGetPayload<{ include: typeof listInclude }>;

export type TrackingBoardQuery = {
  types: FulfillmentType[];
  riderId?: string;
  lateOnly: boolean;
  branchId?: string;
};

function parseBoardQuery(req: Request): TrackingBoardQuery {
  const typeAllowed = Object.values(FulfillmentType);
  const rawType = req.query["type[]"] ?? req.query.type;
  const types: FulfillmentType[] = [];
  if (Array.isArray(rawType)) {
    for (const v of rawType) {
      const s = String(v).trim();
      if (typeAllowed.includes(s as FulfillmentType)) types.push(s as FulfillmentType);
    }
  } else if (typeof rawType === "string" && rawType.trim()) {
    for (const part of rawType.split(",")) {
      const s = part.trim();
      if (typeAllowed.includes(s as FulfillmentType)) types.push(s as FulfillmentType);
    }
  }
  const lateOnly = String(req.query.lateOnly || "").toLowerCase() === "true" || req.query.lateOnly === "1";
  const branchId = String(req.query.branchId || "").trim() || undefined;
  const riderId = String(req.query.riderId || "").trim() || undefined;
  return { types, riderId, lateOnly, branchId };
}

function normalizeAddressDisplay(raw: string) {
  return raw
    .split(",")
    .map((part) =>
      part
        .trim()
        .split(/\s+/)
        .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""))
        .join(" ")
    )
    .filter(Boolean)
    .join(", ");
}

function itemsSummary(items: BoardOrder["items"]) {
  const lines = items.slice(0, 2).map((i) => ({
    quantity: i.quantity,
    name: i.nameAtOrder,
    optionsLabel: i.optionsLabel || "",
  }));
  const extraCount = Math.max(0, items.length - 2);
  const hasAllergy = items.some((i) => /allerg/i.test(i.optionsLabel || ""));
  return {
    lines,
    extraCount,
    hasNotes: false,
    hasAllergyHint: hasAllergy,
  };
}

function riderTimingFromEvents(order: BoardOrder, now: Date) {
  const outEvent = order.events.find((e) => e.toStatus === OrderStatus.OUT_FOR_DELIVERY);
  const assignEvent = [...order.events].reverse().find((e) => e.reason === "assign_rider");
  const assignedAt = assignEvent?.createdAt ?? (order.rider ? order.updatedAt : null);
  const outSinceSeconds =
    order.status === OrderStatus.OUT_FOR_DELIVERY && outEvent
      ? computeAgeSeconds(outEvent.createdAt, now)
      : null;
  return {
    assignedAt: assignedAt?.toISOString() ?? null,
    outSinceSeconds,
  };
}

function mapBoardCard(
  order: BoardOrder,
  role: Role,
  thresholds: {
    lateConfirmMinutes: number;
    latePrepMinutes: number;
    lateDeliveryMinutes: number;
    ordersStaleHours: number;
  },
  deliveryAreasConfigured: boolean,
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
  const derived = canSeePayment(role) ? deriveOrderPayment(paymentRow) : null;
  const payment = derived
    ? {
        status: derived.status,
        methods: derived.methods,
        codDue: derived.codAmount ?? (derived.amountDue > 0 ? derived.amountDue : null),
        label: derived.label,
      }
    : null;

  const primary = primaryNextAction(role, order.status, order.fulfillmentType);
  const next = filterNextActionsForRole(primary ? [primary] : [], role)[0];

  const riderTimes = riderTimingFromEvents(order, now);
  const zoneWarning =
    order.fulfillmentType === FulfillmentType.DELIVERY &&
    deliveryAreasConfigured &&
    !order.deliveryAreaId;

  let address: { text: string; area: string | null; zoneWarning: boolean } | null = null;
  if (order.fulfillmentType === FulfillmentType.DELIVERY) {
    address = {
      text: normalizeAddressDisplay(order.deliveryAddress),
      area: order.deliveryArea?.name ?? null,
      zoneWarning,
    };
  }

  return {
    id: order.id,
    number: fullNumber,
    shortNumber,
    shortDisplay,
    type: order.fulfillmentType,
    source: order.orderSource === "POS" ? "pos" : "online",
    status: order.status,
    outcome:
      COMPLETED_STATUSES.includes(order.status)
        ? order.status === OrderStatus.SERVED
          ? "served"
          : order.status === OrderStatus.COLLECTED
            ? "picked_up"
            : "delivered"
        : null,
    nextAction: next
      ? { verb: next.label, targetStatus: next.targetStatus, action: next.action }
      : null,
    createdAt: order.createdAt.toISOString(),
    statusChangedAt: statusChangedAt.toISOString(),
    ageSeconds,
    isLate,
    isStale,
    customer: {
      name: order.customerName,
      phone: canSeeCustomerPhone(role)
        ? order.customerPhone
        : maskPhoneForRole(order.customerPhone, role),
      phoneMasked: !canSeeCustomerPhone(role),
    },
    itemsSummary: (() => {
      const summary = itemsSummary(order.items);
      return {
        ...summary,
        hasNotes: Boolean(order.notes?.trim()),
        hasAllergyHint: summary.hasAllergyHint || Boolean(order.notes?.match(/allerg/i)),
      };
    })(),
    table:
      order.fulfillmentType === FulfillmentType.DINE_IN
        ? order.diningTable?.label || order.tableNumber || null
        : null,
    address,
    rider:
      order.fulfillmentType === FulfillmentType.DELIVERY && order.rider
        ? {
            id: order.rider.id,
            name: order.rider.name,
            assignedAt: riderTimes.assignedAt,
            outSinceSeconds: riderTimes.outSinceSeconds,
          }
        : null,
    needsRider:
      order.fulfillmentType === FulfillmentType.DELIVERY &&
      !order.riderId &&
      (order.status === OrderStatus.CONFIRMED ||
        order.status === OrderStatus.PREPARING ||
        order.status === OrderStatus.READY),
    total: Number(order.total),
    payment,
    possibleDuplicateOf: null as string | null,
  };
}

function completedWindowBounds(
  timeZone: string,
  trackingCompletedWindowHours: number,
  now: Date
) {
  if (trackingCompletedWindowHours > 0) {
    const start = new Date(now.getTime() - trackingCompletedWindowHours * 60 * 60 * 1000);
    return { start, end: now, mode: "rolling" as const };
  }
  const key = storeDateKey(timeZone, now);
  const { startUtc, endUtc } = utcRangeForStoreDateKey(key, timeZone);
  return { start: startUtc, end: endUtc, mode: "today" as const };
}

function buildBoardWhere(
  scope: BranchScope,
  query: TrackingBoardQuery,
  riderUserId?: string
): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = { ...scope.where };
  if (query.branchId && scope.allBranches) {
    where.branchId = query.branchId;
  }
  if (riderUserId) {
    where.riderId = riderUserId;
  } else if (query.riderId) {
    where.riderId = query.riderId;
  }
  if (query.types.length) {
    where.fulfillmentType = { in: query.types };
  }
  return where;
}

export async function buildTrackingBoard(
  req: Request,
  scope: BranchScope,
  user: AuthUser,
  timeZone: string,
  settings: {
    lateConfirmMinutes: number;
    latePrepMinutes: number;
    lateDeliveryMinutes: number;
    ordersStaleHours: number;
    trackingCompletedWindowHours: number;
    duplicateOrderWindowMinutes: number;
  }
) {
  const started = Date.now();
  const query = parseBoardQuery(req);
  const riderUserId = riderScopeUserId(user.role, user.id);
  const baseWhere = buildBoardWhere(scope, query, riderUserId);
  const now = new Date();
  const completedWindow = completedWindowBounds(timeZone, settings.trackingCompletedWindowHours, now);

  const thresholds = {
    lateConfirmMinutes: settings.lateConfirmMinutes,
    latePrepMinutes: settings.latePrepMinutes,
    lateDeliveryMinutes: settings.lateDeliveryMinutes,
    ordersStaleHours: settings.ordersStaleHours,
  };

  const todayKey = storeDateKey(timeZone, now);
  const cancelledRange = utcRangeForStoreDateKey(todayKey, timeZone);

  const [pipelineOrders, completedOrders, cancelledToday, deliveryAreaCount, pipelineForSummary] =
    await Promise.all([
      prisma.order.findMany({
        where: { ...baseWhere, status: { in: PIPELINE_STATUSES } },
        include: listInclude,
        take: 1500,
      }),
      prisma.order.findMany({
        where: {
          ...baseWhere,
          status: { in: COMPLETED_STATUSES },
          updatedAt: { gte: completedWindow.start, lte: completedWindow.end },
        },
        include: listInclude,
        take: 500,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.order.findMany({
        where: {
          ...baseWhere,
          status: OrderStatus.CANCELLED,
          updatedAt: { gte: cancelledRange.startUtc, lte: cancelledRange.endUtc },
        },
        include: listInclude,
        take: 200,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.deliveryArea.count({ where: { isDelivering: true } }),
      prisma.order.findMany({
        where: { ...baseWhere, status: { in: PIPELINE_STATUSES } },
        select: {
          id: true,
          status: true,
          fulfillmentType: true,
          riderId: true,
          total: true,
          updatedAt: true,
          createdAt: true,
          events: {
            orderBy: { createdAt: "asc" },
            select: { toStatus: true, createdAt: true },
          },
        },
        take: 3000,
      }),
    ]);

  const deliveryAreasConfigured = deliveryAreaCount > 0;
  const allOrders = [...pipelineOrders, ...completedOrders];

  let cards = allOrders.map((o) =>
    mapBoardCard(o, user.role, thresholds, deliveryAreasConfigured, now)
  );

  if (query.lateOnly) {
    cards = cards.filter((c) => c.isLate);
  }

  const dupMap = await loadDuplicateMapBatched(
    allOrders.map((o) => ({
      id: o.id,
      createdAt: o.createdAt,
      customerPhone: o.customerPhone,
      items: o.items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
    })),
    baseWhere,
    settings.duplicateOrderWindowMinutes
  );
  for (const card of cards) {
    card.possibleDuplicateOf = dupMap.get(card.id) ?? null;
  }

  const sortable = allOrders.map((o) => {
    const statusChangedAt = statusChangedAtFromEvents(o.events, o.status, o.updatedAt);
    const minutesInStatus = Math.floor((now.getTime() - statusChangedAt.getTime()) / 60_000);
    return { order: o, card: cards.find((c) => c.id === o.id)!, statusChangedAt, minutesInStatus };
  });

  const lateCardIds = query.lateOnly ? new Set(cards.map((c) => c.id)) : null;

  const pipelineSorted = sortIncomingPipelineOrders(
    sortable
      .filter((r) => PIPELINE_STATUSES.includes(r.order.status))
      .filter((r) => !lateCardIds || lateCardIds.has(r.order.id))
      .map((r) => ({
        orderId: r.order.id,
        status: r.order.status,
        minutesInStatus: r.minutesInStatus,
        updatedAt: r.statusChangedAt,
      })),
    thresholds
  );
  const pipelineOrderIds = pipelineSorted.map((r) => r.orderId);

  const completedIds = sortable
    .filter((r) => COMPLETED_STATUSES.includes(r.order.status))
    .filter((r) => !lateCardIds || lateCardIds.has(r.order.id))
    .sort((a, b) => b.statusChangedAt.getTime() - a.statusChangedAt.getTime())
    .map((r) => r.order.id);

  const cardById = new Map(cards.map((c) => [c.id, c]));

  function orderedCards(ids: string[]) {
    return ids.map((id) => cardById.get(id)).filter(Boolean) as typeof cards;
  }

  const columns = TRACKING_BOARD_COLUMNS.map((col) => {
    const colCards = orderedCards(
      col.id === "COMPLETED"
        ? completedIds
        : pipelineOrderIds.filter((id) => {
            const o = allOrders.find((x) => x.id === id);
            return o && orderBelongsInColumn(o.status, o.fulfillmentType, col.id);
          })
    );
    const value =
      col.id === "COMPLETED"
        ? 0
        : colCards.reduce((sum, c) => sum + c.total, 0);
    return {
      id: col.id,
      label: col.label,
      count: colCards.length,
      value: Math.round(value * 100) / 100,
      cards: colCards,
      ...(col.id === "COMPLETED"
        ? {
            historyLink: `/admin/orders?from=${todayKey}&to=${todayKey}`,
          }
        : {}),
    };
  });

  const cancelledCards = cancelledToday.map((o) =>
    mapBoardCard(o, user.role, thresholds, deliveryAreasConfigured, now)
  );

  const summary = computeTrackingBoardSummaryFromOrders(pipelineForSummary, thresholds, now);

  const elapsedMs = Date.now() - started;

  return {
    columns,
    cancelledToday: {
      count: cancelledCards.length,
      cards: cancelledCards,
    },
    summary,
    completedWindow: {
      mode: completedWindow.mode,
      hours: settings.trackingCompletedWindowHours,
    },
    serverTime: now.toISOString(),
    timezone: timeZone,
    timingMs: elapsedMs,
  };
}

export async function buildTrackingSummary(
  scope: BranchScope,
  user: AuthUser,
  timeZone: string,
  settings: {
    lateConfirmMinutes: number;
    latePrepMinutes: number;
    lateDeliveryMinutes: number;
    ordersStaleHours: number;
  }
) {
  const query = { types: [] as FulfillmentType[], lateOnly: false, branchId: undefined };
  const riderUserId = riderScopeUserId(user.role, user.id);
  const baseWhere = buildBoardWhere(scope, query, riderUserId);
  const now = new Date();
  const thresholds = {
    lateConfirmMinutes: settings.lateConfirmMinutes,
    latePrepMinutes: settings.latePrepMinutes,
    lateDeliveryMinutes: settings.lateDeliveryMinutes,
    ordersStaleHours: settings.ordersStaleHours,
  };

  const pipelineForSummary = await prisma.order.findMany({
    where: { ...baseWhere, status: { in: PIPELINE_STATUSES } },
    select: {
      id: true,
      status: true,
      fulfillmentType: true,
      riderId: true,
      total: true,
      updatedAt: true,
      createdAt: true,
      events: {
        orderBy: { createdAt: "asc" },
        select: { toStatus: true, createdAt: true },
      },
    },
    take: 3000,
  });

  const summary = computeTrackingBoardSummaryFromOrders(pipelineForSummary, thresholds, now);
  return {
    summary,
    badge: summary.late > 0 ? summary.late : summary.active,
    serverTime: now.toISOString(),
    timezone: timeZone,
  };
}
