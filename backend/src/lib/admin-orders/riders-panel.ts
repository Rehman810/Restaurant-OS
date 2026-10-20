import { OrderStatus, RiderCashEntryStatus } from "@prisma/client";
import { prisma } from "../prisma";
import type { BranchScope } from "../branch-scope";
import { riderWhereForScope, orderBranchWhere } from "../branch-scope";
import { deriveShortOrderNumber } from "../order-number";
import { computeAgeSeconds } from "./timing";
import { canSeeRiderLocation } from "./role-filter";
import type { Role } from "@prisma/client";

export async function buildTrackingRidersPanel(scope: BranchScope, role: Role) {
  const orderBranch = orderBranchWhere(scope);
  const riderWhere = { ...riderWhereForScope(scope), isActive: true };

  const riders = await prisma.user.findMany({
    where: riderWhere,
    select: { id: true, name: true, phone: true, isActive: true },
    orderBy: { name: "asc" },
  });

  const activeDeliveries = await prisma.order.findMany({
    where: {
      ...orderBranch,
      riderId: { not: null },
      status: OrderStatus.OUT_FOR_DELIVERY,
      fulfillmentType: "DELIVERY",
    },
    select: {
      id: true,
      orderNumber: true,
      riderId: true,
      total: true,
      events: {
        where: { toStatus: OrderStatus.OUT_FOR_DELIVERY },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  const pendingCash = await prisma.riderCashEntry.groupBy({
    by: ["riderId"],
    where: {
      ...orderBranch,
      status: RiderCashEntryStatus.PENDING,
    },
    _sum: { expectedAmount: true },
  });
  const cashMap = new Map(
    pendingCash.map((r) => [r.riderId, Number(r._sum.expectedAmount ?? 0)])
  );

  const deliveryCountByRider = new Map<string, number>();
  for (const r of riders) deliveryCountByRider.set(r.id, 0);

  const activeByRider = new Map<
    string,
    { id: string; shortDisplay: string; outSinceSeconds: number }[]
  >();

  const now = new Date();
  for (const o of activeDeliveries) {
    if (!o.riderId) continue;
    const short = deriveShortOrderNumber(o.orderNumber).shortDisplay;
    const outAt = o.events[0]?.createdAt ?? now;
    const outSinceSeconds = computeAgeSeconds(outAt, now);
    const list = activeByRider.get(o.riderId) ?? [];
    list.push({ id: o.id, shortDisplay: short, outSinceSeconds });
    activeByRider.set(o.riderId, list);
    deliveryCountByRider.set(o.riderId, (deliveryCountByRider.get(o.riderId) ?? 0) + 1);
  }

  return riders.map((rider) => {
    const deliveries = activeByRider.get(rider.id) ?? [];
    const longestOutSince = deliveries.reduce((max, d) => Math.max(max, d.outSinceSeconds), 0);
    return {
      id: rider.id,
      name: rider.name,
      status: deliveries.length ? "on_delivery" : "available",
      activeDeliveries: deliveries,
      activeDeliveryCount: deliveries.length,
      longestOutSinceSeconds: deliveries.length ? longestOutSince : null,
      codCashHeld: Math.round((cashMap.get(rider.id) ?? 0) * 100) / 100,
      location: canSeeRiderLocation(role)
        ? { locationAvailable: false as const }
        : { locationAvailable: false as const, hidden: true },
    };
  });
}
