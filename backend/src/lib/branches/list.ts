import {
  CashShiftStatus,
  OrderStatus,
  Role,
} from "@prisma/client";
import { prisma } from "../prisma";
import { getStoreSettings } from "../settings-data";
import { resolveDashboardTimezone } from "../dashboard/summary";
import { storeTodayUtcRange } from "../reports/time-range";
import { aggregatePeriodOrderMetrics } from "../metrics/period-stats";
import { PIPELINE_STATUSES, isIncomingOrderLate } from "../dashboard/order-completion";
import { resolveBranchOpenState } from "./open-state";
import { deriveSetupChecklist } from "./checklist";
import { parseBranchesListRange, resolveBranchesRange, previousPeriodRange } from "./range";
import type { BranchesListRange } from "./range";

const branchSelect = {
  id: true,
  name: true,
  code: true,
  address: true,
  addressLine: true,
  area: true,
  city: true,
  latitude: true,
  longitude: true,
  email: true,
  phone: true,
  managerUserId: true,
  managerUser: { select: { id: true, name: true } },
  acceptsOnlineOrders: true,
  isActive: true,
  deactivatedAt: true,
  isDefault: true,
  sortOrder: true,
  timezone: true,
  createdAt: true,
} as const;

export async function listAdminBranches(opts: {
  range: BranchesListRange;
  includePerformance: boolean;
  branchIds?: string[];
}) {
  const t0 = Date.now();
  const settings = await getStoreSettings();
  const timezone = await resolveDashboardTimezone({ allBranches: true, branchId: null });
  const { start: todayStart, end: todayEnd } = storeTodayUtcRange(timezone);
  const period = resolveBranchesRange(opts.range, timezone);
  const prevPeriod = previousPeriodRange(period, timezone);

  const where = opts.branchIds?.length ? { id: { in: opts.branchIds } } : {};
  const branches = await prisma.branch.findMany({
    where,
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: branchSelect,
  });

  const ids = branches.map((b) => b.id);
  if (!ids.length) {
    return { branches: [], meta: { timezone, range: opts.range, ms: Date.now() - t0 } };
  }

  const [
    memberCounts,
    tableCounts,
    stationCounts,
    openShiftsByBranch,
    pipelineByBranch,
    todayMetrics,
    lateThresholds,
  ] = await Promise.all([
    prisma.branchMember.groupBy({ by: ["branchId"], where: { branchId: { in: ids } }, _count: true }),
    prisma.diningTable.groupBy({ by: ["branchId"], where: { branchId: { in: ids } }, _count: true }),
    prisma.printStation.groupBy({ by: ["branchId"], where: { branchId: { in: ids } }, _count: true }),
    prisma.cashShift.groupBy({
      by: ["branchId"],
      where: { branchId: { in: ids }, status: CashShiftStatus.OPEN },
      _count: true,
    }),
    prisma.order.groupBy({
      by: ["branchId"],
      where: { branchId: { in: ids }, status: { in: PIPELINE_STATUSES } },
      _count: true,
    }),
    Promise.all(
      ids.map(async (branchId) => {
        const m = await aggregatePeriodOrderMetrics({ branchId }, todayStart, todayEnd);
        return { branchId, ...m };
      })
    ),
    Promise.resolve({
      lateConfirmMinutes: settings.lateConfirmMinutes ?? 15,
      latePrepMinutes: settings.latePrepMinutes ?? 30,
      lateDeliveryMinutes: settings.lateDeliveryMinutes ?? 45,
    }),
  ]);

  const deliveryAreaCount = await prisma.deliveryArea.count({ where: { isDelivering: true } });

  const memberMap = new Map(memberCounts.map((r) => [r.branchId, r._count]));
  const tableMap = new Map(tableCounts.map((r) => [r.branchId, r._count]));
  const stationMap = new Map(stationCounts.map((r) => [r.branchId, r._count]));
  const shiftMap = new Map(openShiftsByBranch.map((r) => [r.branchId, r._count]));
  const pipelineMap = new Map(pipelineByBranch.map((r) => [r.branchId, r._count]));
  const todayMap = new Map(todayMetrics.map((r) => [r.branchId, r]));

  const activeOrders = await prisma.order.findMany({
    where: { branchId: { in: ids }, status: { in: PIPELINE_STATUSES } },
    select: { branchId: true, status: true, updatedAt: true },
  });
  const lateByBranch = new Map<string, number>();
  const now = new Date();
  for (const o of activeOrders) {
    if (!o.branchId) continue;
    const mins = Math.max(0, Math.floor((now.getTime() - o.updatedAt.getTime()) / 60000));
    if (isIncomingOrderLate(o.status, mins, lateThresholds)) {
      lateByBranch.set(o.branchId, (lateByBranch.get(o.branchId) ?? 0) + 1);
    }
  }

  let performanceByBranch: Map<string, Awaited<ReturnType<typeof branchPerformance>>> | null = null;
  if (opts.includePerformance) {
    const perf = await Promise.all(
      ids.map((id) => branchPerformance(id, period, prevPeriod, lateThresholds))
    );
    performanceByBranch = new Map(perf.map((p) => [p.branchId, p]));
  }

  const openStates = await Promise.all(
    branches.map(async (b) => ({ id: b.id, open: await resolveBranchOpenState(b.timezone) }))
  );
  const openMap = new Map(openStates.map((o) => [o.id, o.open]));

  const checklists = await Promise.all(
    branches.map(async (b) => ({ id: b.id, checklist: await deriveSetupChecklist(b.id) }))
  );
  const checklistMap = new Map(checklists.map((c) => [c.id, c.checklist]));

  const enriched = branches.map((b) => {
    const today = todayMap.get(b.id);
    const open = openMap.get(b.id)!;
    return {
      ...b,
      status: b.isActive ? "ACTIVE" : "INACTIVE",
      open,
      counts: {
        staff: memberMap.get(b.id) ?? 0,
        tables: tableMap.get(b.id) ?? 0,
        printStations: stationMap.get(b.id) ?? 0,
        deliveryAreas: deliveryAreaCount,
      },
      live: {
        ordersToday: today?.ordersCount ?? 0,
        collectedToday: today?.collected ?? 0,
        bookedToday: today?.booked ?? 0,
        inProgress: pipelineMap.get(b.id) ?? 0,
        lateOrders: lateByBranch.get(b.id) ?? 0,
        openShifts: shiftMap.get(b.id) ?? 0,
      },
      performance: performanceByBranch?.get(b.id)?.metrics ?? undefined,
      performanceDelta: performanceByBranch?.get(b.id)?.delta ?? undefined,
      setupChecklist: checklistMap.get(b.id),
    };
  });

  const ms = Date.now() - t0;
  return {
    branches: enriched,
    meta: { timezone, range: opts.range, periodFrom: period.fromKey, periodTo: period.toKey, ms },
  };
}

async function branchPerformance(
  branchId: string,
  current: ReturnType<typeof resolveBranchesRange>,
  previous: ReturnType<typeof previousPeriodRange>,
  thresholds: { lateConfirmMinutes: number; latePrepMinutes: number; lateDeliveryMinutes: number }
) {
  const [cur, prev, feedback, ordersForLate] = await Promise.all([
    aggregatePeriodOrderMetrics({ branchId }, current.startUtc, current.endUtc),
    aggregatePeriodOrderMetrics({ branchId }, previous.startUtc, previous.endUtc),
    prisma.orderFeedback.aggregate({
      where: {
        order: {
          branchId,
          createdAt: { gte: current.startUtc, lte: current.endUtc },
        },
      },
      _avg: { rating: true },
      _count: true,
    }),
    prisma.order.findMany({
      where: {
        branchId,
        createdAt: { gte: current.startUtc, lte: current.endUtc },
        status: { not: OrderStatus.CANCELLED },
      },
      select: { status: true, updatedAt: true },
      take: 500,
    }),
  ]);

  let late = 0;
  const now = new Date();
  for (const o of ordersForLate) {
    const mins = Math.max(0, Math.floor((now.getTime() - o.updatedAt.getTime()) / 60000));
    if (isIncomingOrderLate(o.status, mins, thresholds)) late += 1;
  }
  const latePercent = ordersForLate.length ? Math.round((late / ordersForLate.length) * 1000) / 10 : 0;

  const metrics = {
    orders: cur.ordersCount,
    collected: cur.collected,
    avgOrderValue: cur.avgOrderValue,
    latePercent,
    avgRating: feedback._count ? Math.round((Number(feedback._avg.rating ?? 0)) * 10) / 10 : null,
  };

  const delta = {
    orders: cur.ordersCount - prev.ordersCount,
    collected: cur.collected - prev.collected,
    avgOrderValue: cur.avgOrderValue - prev.avgOrderValue,
  };

  return { branchId, metrics, delta };
}

export function parseListRangeQuery(raw: unknown): BranchesListRange {
  return parseBranchesListRange(raw);
}

export async function assertManagerIsBranchMember(userId: string, branchId: string, role: Role) {
  if (role === Role.ADMIN) return true;
  const member = await prisma.branchMember.findFirst({
    where: { userId, branchId, branch: { isActive: true } },
    select: { id: true },
  });
  return Boolean(member);
}
