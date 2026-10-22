import { OrderStatus, Role } from "@prisma/client";
import { prisma } from "../prisma";
import { deriveShortOrderNumber } from "../order-number";
import { deriveOrderPayment } from "./payment";
import { nextActionsForRole } from "./next-actions";
import {
  canSeeCustomerPhone,
  canSeeIpLocation,
  canSeePayment,
  filterNextActionsForRole,
  maskPhoneForRole,
} from "./role-filter";
import {
  computeAgeSeconds,
  computeIsLate,
  computeIsStale,
  statusChangedAtFromEvents,
} from "./timing";
import { findPossibleDuplicateOf } from "./duplicates";
import type { AuthUser } from "../../middleware/auth";

const detailInclude = {
  items: {
    include: {
      menuItem: { select: { id: true, name: true } },
    },
  },
  rider: { select: { id: true, name: true, phone: true } },
  diningTable: { select: { id: true, label: true } },
  deliveryArea: { select: { id: true, name: true } },
  payments: { orderBy: { sortOrder: "asc" as const } },
  events: {
    orderBy: { createdAt: "asc" as const },
  },
  kotPrintLogs: { orderBy: { createdAt: "desc" as const }, take: 10 },
  invoice: true,
  customer: { select: { id: true, name: true, email: true } },
};

export async function getAdminOrderDetail(
  orderId: string,
  user: AuthUser,
  settings: {
    lateConfirmMinutes: number;
    latePrepMinutes: number;
    lateDeliveryMinutes: number;
    ordersStaleHours: number;
    duplicateOrderWindowMinutes: number;
  }
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: detailInclude,
  });
  if (!order) return null;

  const actorIds = [...new Set(order.events.map((e) => e.actorId).filter(Boolean))] as string[];
  const actors =
    actorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true },
        })
      : [];
  const actorMap = new Map(actors.map((a) => [a.id, a.name]));

  const { shortNumber, shortDisplay, fullNumber } = deriveShortOrderNumber(order.orderNumber);
  const statusChangedAt = statusChangedAtFromEvents(order.events, order.status, order.updatedAt);
  const ageSeconds = computeAgeSeconds(statusChangedAt);
  const minutesInStatus = Math.floor(ageSeconds / 60);
  const thresholds = {
    lateConfirmMinutes: settings.lateConfirmMinutes,
    latePrepMinutes: settings.latePrepMinutes,
    lateDeliveryMinutes: settings.lateDeliveryMinutes,
  };

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

  const prevOrdersCount = order.customerId
    ? await prisma.order.count({
        where: {
          customerId: order.customerId,
          id: { not: order.id },
        },
      })
    : await prisma.order.count({
        where: {
          customerPhone: order.customerPhone,
          id: { not: order.id },
        },
      });

  const recentOrders = await prisma.order.findMany({
    where: order.customerId
      ? { customerId: order.customerId, id: { not: order.id } }
      : { customerPhone: order.customerPhone, id: { not: order.id } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      total: true,
      createdAt: true,
    },
  });

  const dupCandidates = await prisma.order.findMany({
    where: {
      createdAt: {
        gte: new Date(order.createdAt.getTime() - settings.duplicateOrderWindowMinutes * 60_000),
        lt: order.createdAt,
      },
      customerPhone: { contains: order.customerPhone.replace(/\D/g, "").slice(-10) || "0" },
    },
    select: {
      id: true,
      createdAt: true,
      customerPhone: true,
      items: { select: { menuItemId: true, quantity: true } },
    },
    take: 20,
  });

  const possibleDuplicateOf = findPossibleDuplicateOf(
    {
      id: order.id,
      createdAt: order.createdAt,
      customerPhone: order.customerPhone,
      items: order.items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
    },
    dupCandidates,
    settings.duplicateOrderWindowMinutes
  );

  const timeline = order.events.map((e) => ({
    fromStatus: e.fromStatus,
    toStatus: e.toStatus,
    at: e.createdAt.toISOString(),
    actor: e.actorId ? { id: e.actorId, name: actorMap.get(e.actorId) ?? "Staff", role: e.actorRole } : null,
    reason: e.reason,
  }));

  if (!order.events.some((e) => e.toStatus === OrderStatus.PENDING_CONFIRMATION)) {
    timeline.unshift({
      fromStatus: null,
      toStatus: OrderStatus.PENDING_CONFIRMATION,
      at: order.createdAt.toISOString(),
      actor: null,
      reason: "created",
    });
  }

  return {
    id: order.id,
    number: fullNumber,
    shortNumber,
    shortDisplay,
    type: order.fulfillmentType,
    source: order.orderSource === "POS" ? "pos" : "online",
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    statusChangedAt: statusChangedAt.toISOString(),
    ageSeconds,
    isLate: computeIsLate(order.status, minutesInStatus, thresholds),
    isStale: computeIsStale(statusChangedAt, order.status, settings.ordersStaleHours),
    nextActions: filterNextActionsForRole(
      nextActionsForRole(user.role, order.status, order.fulfillmentType),
      user.role
    ),
    items: order.items.map((i) => ({
      id: i.id,
      menuItemId: i.menuItemId,
      name: i.nameAtOrder,
      quantity: i.quantity,
      price: Number(i.priceAtOrder),
      optionsLabel: i.optionsLabel,
      instructions: i.instructions,
    })),
    totals: {
      subtotal: Number(order.subtotal),
      deliveryCharge: Number(order.deliveryCharge),
      taxAmount: Number(order.taxAmount),
      discountAmount: Number(order.discountAmount),
      serviceAmount: Number(order.serviceAmount),
      total: Number(order.total),
    },
    payment: canSeePayment(user.role) ? deriveOrderPayment(paymentRow) : null,
    payments: canSeePayment(user.role)
      ? order.payments.map((p) => ({
          method: p.method,
          amount: Number(p.amount),
          tendered: p.tendered != null ? Number(p.tendered) : null,
          changeGiven: p.changeGiven != null ? Number(p.changeGiven) : null,
          at: p.createdAt.toISOString(),
        }))
      : null,
    customer: {
      name: order.customerName,
      phone: canSeeCustomerPhone(user.role)
        ? order.customerPhone
        : maskPhoneForRole(order.customerPhone, user.role),
      email: order.customerEmail,
      previousOrdersCount: prevOrdersCount,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        total: Number(o.total),
        createdAt: o.createdAt.toISOString(),
      })),
    },
    table: order.diningTable?.label || order.tableNumber || null,
    address: order.deliveryAddress,
    deliveryArea: order.deliveryAreaNameSnap ?? order.deliveryArea?.name ?? null,
    deliveryAddressAreaWarning: order.deliveryAddressAreaWarning === true,
    deliveryEta:
      order.deliveryEtaMinSnap != null && order.deliveryEtaMaxSnap != null
        ? { minMinutes: order.deliveryEtaMinSnap, maxMinutes: order.deliveryEtaMaxSnap }
        : null,
    rider: order.rider
      ? { id: order.rider.id, name: order.rider.name, phone: order.rider.phone }
      : null,
    notes: order.notes,
    timeline,
    print: {
      kotPrintedAt: order.kotPrintedAt?.toISOString() ?? null,
      kotPrintCount: order.kotPrintCount,
      kotLogs: order.kotPrintLogs.map((l) => ({
        at: l.createdAt.toISOString(),
        isReprint: l.isReprint,
      })),
      invoice: order.invoice
        ? { id: order.invoice.id, invoiceNumber: order.invoice.invoiceNumber }
        : null,
    },
    possibleDuplicateOf,
    location: canSeeIpLocation(user.role)
      ? {
          ip: order.customerIp,
          latitude: order.customerLatitude != null ? Number(order.customerLatitude) : null,
          longitude: order.customerLongitude != null ? Number(order.customerLongitude) : null,
          accuracy: order.customerLocationAccuracy != null ? Number(order.customerLocationAccuracy) : null,
        }
      : null,
  };
}
