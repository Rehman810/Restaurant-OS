import { prisma } from "../prisma";
import { enrichCategory } from "../category-meta";
import { categoryUsageDishCount } from "./usage";
import { categoryScheduleSummary, evaluateCategorySchedule } from "./category-schedule";

export type AdminCategoryListQuery = {
  q?: string;
  status?: string[];
  includeArchived?: boolean;
  timezone: string;
  page?: number;
  pageSize?: number;
};

export async function listAdminCategories(query: AdminCategoryListQuery) {
  const search = query.q?.trim();
  const statusFilter = new Set((query.status ?? []).map(String));
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 10));
  const skip = (page - 1) * pageSize;

  const where = {
    ...(query.includeArchived ? {} : { archivedAt: null }),
    ...(statusFilter.has("hidden") && !statusFilter.has("active") && !statusFilter.has("scheduled")
      ? { isVisible: false }
      : statusFilter.has("active") && !statusFilter.has("scheduled") && !statusFilter.has("hidden")
        ? { isVisible: true }
        : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { tagline: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const needsScheduleFilter = statusFilter.has("scheduled") || (statusFilter.has("active") && statusFilter.size === 1);

  const [categories, totalCount] = await Promise.all([
    prisma.category.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      ...(needsScheduleFilter ? {} : { skip, take: pageSize }),
    }),
    prisma.category.count({ where }),
  ]);

  const rows = await Promise.all(
    categories.map(async (cat) => {
      const enriched = enrichCategory(cat);
      const scheduleStatus = evaluateCategorySchedule(cat, new Date(), query.timezone);
      const dishCount = await categoryUsageDishCount(cat.name);
      return {
        id: cat.id,
        name: enriched.name,
        tagline: enriched.tagline,
        imageUrl: enriched.imageUrl,
        sortOrder: cat.sortOrder,
        isVisible: cat.isVisible,
        archivedAt: cat.archivedAt?.toISOString() ?? null,
        scheduleDays: cat.scheduleDays,
        scheduleStartMinutes: cat.scheduleStartMinutes,
        scheduleEndMinutes: cat.scheduleEndMinutes,
        dishCount,
        scheduleStatus,
        scheduleSummary: categoryScheduleSummary(cat),
      };
    })
  );

  const filtered = statusFilter.size
    ? rows.filter((r) => statusFilter.has(r.scheduleStatus) || (statusFilter.has("hidden") && r.archivedAt))
    : rows;

  const pageRows = needsScheduleFilter ? filtered.slice(skip, skip + pageSize) : filtered;

  const [activeCount, hiddenCount] = await Promise.all([
    prisma.category.count({ where: { archivedAt: null, isVisible: true } }),
    prisma.category.count({ where: { OR: [{ archivedAt: { not: null } }, { isVisible: false }] } }),
  ]);

  return {
    rows: pageRows,
    total: needsScheduleFilter ? filtered.length : totalCount,
    page,
    pageSize,
    counts: { active: activeCount, scheduled: 0, hidden: hiddenCount },
  };
}
