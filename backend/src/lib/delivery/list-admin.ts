import { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { loadActivePauses, areaIsPausedByRecords } from "./pause";
import { serializeAdminAreaRow } from "./serialize";

export type AreasListQuery = {
  q?: string;
  status?: "delivering" | "paused" | "archived" | "all";
  sort?: "position" | "name" | "charge" | "orders";
  page?: number;
  pageSize?: number;
};

function areaStatusFilter(status: AreasListQuery["status"]): Prisma.DeliveryAreaWhereInput {
  if (status === "archived") return { archivedAt: { not: null } };
  const base: Prisma.DeliveryAreaWhereInput = { archivedAt: null };
  if (status === "delivering") return { ...base, isDelivering: true };
  if (status === "paused") return { ...base, isDelivering: false };
  return base;
}

export async function listAdminAreas(restaurantId: string, query: AreasListQuery) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 50));
  const q = (query.q ?? "").trim();
  const status = query.status ?? "all";
  const sort = query.sort ?? "position";

  const where: Prisma.DeliveryAreaWhereInput = {
    restaurantId,
    ...areaStatusFilter(status),
  };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { covers: { has: q } },
    ];
  }

  const orderBy: Prisma.DeliveryAreaOrderByWithRelationInput[] =
    sort === "name"
      ? [{ name: "asc" }]
      : sort === "charge"
        ? [{ deliveryCharge: "asc" }]
        : [{ sortOrder: "asc" }, { name: "asc" }];

  const [total, rows, pauses] = await Promise.all([
    prisma.deliveryArea.count({ where }),
    prisma.deliveryArea.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { branchLinks: { select: { branchId: true } } },
    }),
    loadActivePauses(restaurantId),
  ]);

  const areaIds = rows.map((r) => r.id);
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const orderCounts =
    areaIds.length === 0
      ? []
      : await prisma.order.groupBy({
          by: ["deliveryAreaId"],
          where: {
            deliveryAreaId: { in: areaIds },
            createdAt: { gte: since },
            status: { not: OrderStatus.CANCELLED },
          },
          _count: { _all: true },
        });

  const countMap = new Map(
    orderCounts.map((c) => [c.deliveryAreaId!, c._count._all])
  );

  const avgMap = new Map<string, number>();
  if (areaIds.length > 0) {
    const delivered = await prisma.order.findMany({
      where: {
        deliveryAreaId: { in: areaIds },
        createdAt: { gte: since },
        status: OrderStatus.DELIVERED,
      },
      select: {
        deliveryAreaId: true,
        createdAt: true,
        events: {
          where: { toStatus: OrderStatus.DELIVERED },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { createdAt: true },
        },
      },
      take: 5000,
    });
    const buckets = new Map<string, number[]>();
    for (const o of delivered) {
      if (!o.deliveryAreaId) continue;
      const ev = o.events[0];
      if (!ev) continue;
      const mins = (ev.createdAt.getTime() - o.createdAt.getTime()) / 60000;
      if (mins < 0 || mins > 24 * 60) continue;
      const arr = buckets.get(o.deliveryAreaId) ?? [];
      arr.push(mins);
      buckets.set(o.deliveryAreaId, arr);
    }
    for (const [id, vals] of buckets) {
      if (!vals.length) continue;
      avgMap.set(id, Math.round(vals.reduce((a, b) => a + b, 0) / vals.length));
    }
  }

  const allActive = await prisma.deliveryArea.findMany({
    where: { restaurantId, archivedAt: null },
    select: { id: true, isDelivering: true },
  });
  let deliveringCount = 0;
  let pausedCount = 0;
  for (const a of allActive) {
    const paused = areaIsPausedByRecords(a.id, pauses) || !a.isDelivering;
    if (paused) pausedCount += 1;
    else deliveringCount += 1;
  }

  const globalPause = pauses.find((p) => p.scope === "all");

  const serialized = rows.map((area) => {
    const paused = areaIsPausedByRecords(area.id, pauses) || !area.isDelivering;
    return serializeAdminAreaRow({
      ...area,
      ordersCount30d: countMap.get(area.id) ?? 0,
      avgDeliveryMinutes: avgMap.get(area.id) ?? null,
      branchIds: area.branchLinks.map((l) => l.branchId),
      paused,
    });
  });

  if (sort === "orders") {
    serialized.sort((a, b) => b.ordersCount30d - a.ordersCount30d);
  }

  return {
    rows: serialized,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    summary: {
      deliveringCount,
      pausedCount,
      archivedCount: await prisma.deliveryArea.count({
        where: { restaurantId, archivedAt: { not: null } },
      }),
      activePause: globalPause
        ? {
            id: globalPause.id,
            scope: globalPause.scope,
            areaIds: globalPause.areaIds,
            pausedAt: globalPause.pausedAt.toISOString(),
            until: globalPause.until?.toISOString() ?? null,
            reason: globalPause.reason,
            pausedBy: globalPause.pausedBy,
          }
        : pauses[0]
          ? {
              id: pauses[0].id,
              scope: pauses[0].scope,
              areaIds: pauses[0].areaIds,
              pausedAt: pauses[0].pausedAt.toISOString(),
              until: pauses[0].until?.toISOString() ?? null,
              reason: pauses[0].reason,
              pausedBy: pauses[0].pausedBy,
            }
          : null,
      pauses: pauses.map((p) => ({
        id: p.id,
        scope: p.scope,
        areaIds: p.areaIds,
        pausedAt: p.pausedAt.toISOString(),
        until: p.until?.toISOString() ?? null,
        reason: p.reason,
        pausedBy: p.pausedBy,
      })),
    },
  };
}
