import { prisma } from "../prisma";
import { dealComponentSum, dealPriceWarning, dealSavings, evaluateDealSchedule } from "./deals";
import { resolveAvailability } from "./availability";

export type AdminDealListQuery = {
  branchId: string;
  timezone: string;
  q?: string;
  group?: string;
  status?: string[];
  page?: number;
  pageSize?: number;
};

export async function listAdminDeals(query: AdminDealListQuery) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 10));

  const where = {
    archivedAt: null,
    ...(query.q?.trim()
      ? {
          OR: [
            { title: { contains: query.q.trim(), mode: "insensitive" as const } },
            { description: { contains: query.q.trim(), mode: "insensitive" as const } },
            { category: { contains: query.q.trim(), mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(query.group?.trim() ? { category: { equals: query.group.trim(), mode: "insensitive" as const } } : {}),
  };

  const status = new Set((query.status ?? []).map((s) => s.toLowerCase()));
  const skip = (page - 1) * pageSize;
  const scheduleFilter = status.has("active") || status.has("scheduled") || status.has("expired");

  const [deals, overrides, totalRaw] = await Promise.all([
    prisma.deal.findMany({
      where: {
        ...where,
        ...(status.has("hidden") && !scheduleFilter
          ? { OR: [{ isVisible: false }, { isActive: false }] }
          : {}),
      },
      include: {
        items: { include: { menuItem: { select: { id: true, name: true, price: true, imageUrl: true, archivedAt: true } } } },
      },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      ...(scheduleFilter ? {} : { skip, take: pageSize }),
    }),
    prisma.dealBranchAvailability.findMany({ where: { branchId: query.branchId } }),
    prisma.deal.count({
      where: {
        ...where,
        ...(status.has("hidden") && !scheduleFilter
          ? { OR: [{ isVisible: false }, { isActive: false }] }
          : {}),
      },
    }),
  ]);

  const overrideMap = new Map(overrides.map((o) => [o.dealId, o]));

  const rows = await Promise.all(
    deals.map(async (deal) => {
      const componentSum = dealComponentSum(deal.items);
      const price = Number(deal.dealPrice);
      const scheduleStatus = evaluateDealSchedule(deal, new Date(), query.timezone);
      const avail = resolveAvailability(overrideMap.get(deal.id) ?? null, query.timezone, false);
      const soldUnits = await prisma.orderItem.count({
        where: { nameAtOrder: { startsWith: `${deal.title} ·` } },
      });
      return {
        id: deal.id,
        title: deal.title,
        description: deal.description,
        group: deal.category,
        dealPrice: price,
        componentSum,
        savings: dealSavings(componentSum, price),
        priceWarning: dealPriceWarning(componentSum, price),
        thumbnail: deal.thumbnailUrl || deal.imageUrl,
        visibility: deal.isVisible && deal.isActive ? "visible" : "hidden",
        availability: avail,
        scheduleStatus,
        scheduleSummary: scheduleSummary(deal),
        channels: {
          online: deal.channelOnline,
          pos: deal.channelPos,
          dineIn: deal.channelDineIn,
        },
        perOrderLimit: deal.perOrderLimit,
        unitsSold: soldUnits,
        items: deal.items.map((i) => ({
          menuItemId: i.menuItemId,
          name: i.menuItem.name,
          quantity: i.quantity,
          price: Number(i.menuItem.price),
        })),
        sortOrder: deal.sortOrder,
        updatedAt: deal.updatedAt.toISOString(),
        _flags: { scheduleStatus, visible: deal.isVisible && deal.isActive, avail },
      };
    })
  );

  let filtered = rows;
  if (status.has("active")) filtered = filtered.filter((r) => r.scheduleStatus === "active" && r._flags.visible);
  if (status.has("scheduled")) filtered = filtered.filter((r) => r.scheduleStatus === "scheduled");
  if (status.has("expired")) filtered = filtered.filter((r) => r.scheduleStatus === "expired");
  if (status.has("hidden")) filtered = filtered.filter((r) => !r._flags.visible);

  const start = (page - 1) * pageSize;
  const pageRows = (scheduleFilter ? filtered.slice(start, start + pageSize) : filtered).map(({ _flags, ...rest }) => rest);

  const [activeCount, hiddenCount] = await Promise.all([
    prisma.deal.count({ where: { ...where, isVisible: true, isActive: true } }),
    prisma.deal.count({ where: { ...where, OR: [{ isVisible: false }, { isActive: false }] } }),
  ]);

  return {
    rows: pageRows,
    total: scheduleFilter ? filtered.length : totalRaw,
    page,
    pageSize,
    counts: {
      active: activeCount,
      scheduled: 0,
      expired: 0,
      hidden: hiddenCount,
    },
  };
}

function scheduleSummary(deal: {
  scheduleDays: number[];
  scheduleStartMinutes: number | null;
  scheduleEndMinutes: number | null;
  scheduleStartsAt: Date | null;
  scheduleEndsAt: Date | null;
}) {
  const parts: string[] = [];
  if (deal.scheduleStartsAt) parts.push(`From ${deal.scheduleStartsAt.toISOString().slice(0, 10)}`);
  if (deal.scheduleEndsAt) parts.push(`Until ${deal.scheduleEndsAt.toISOString().slice(0, 10)}`);
  if (deal.scheduleDays.length && deal.scheduleStartMinutes != null && deal.scheduleEndMinutes != null) {
    const sh = Math.floor(deal.scheduleStartMinutes / 60);
    const sm = deal.scheduleStartMinutes % 60;
    const eh = Math.floor(deal.scheduleEndMinutes / 60);
    const em = deal.scheduleEndMinutes % 60;
    parts.push(`${sh}:${String(sm).padStart(2, "0")}–${eh}:${String(em).padStart(2, "0")} daily`);
  }
  return parts.join(" · ") || "Always on";
}
