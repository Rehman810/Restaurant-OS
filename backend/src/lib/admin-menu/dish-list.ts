import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { effectiveItemPrice } from "../store-settings";
import { resolveAvailability } from "./availability";

export type DishListQuery = {
  branchId: string;
  timezone: string;
  q?: string;
  categoryId?: string;
  status?: string[];
  tag?: string;
  page?: number;
  pageSize?: number;
  includeCost?: boolean;
};

const DEFAULT_PAGE_SIZE = 10;

function parseStatus(raw: string[] | undefined) {
  return new Set((raw ?? []).map((s) => s.toLowerCase()));
}

export async function listAdminDishes(query: DishListQuery) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const status = parseStatus(query.status);
  const skip = (page - 1) * pageSize;

  let categoryName: string | undefined;
  if (query.categoryId) {
    const cat = await prisma.category.findUnique({ where: { id: query.categoryId }, select: { name: true } });
    categoryName = cat?.name;
  }

  const soldOutRows = await prisma.menuItemBranchAvailability.findMany({
    where: { branchId: query.branchId, soldOut: true },
    select: { menuItemId: true },
  });
  const soldOutIds = soldOutRows.map((r) => r.menuItemId);

  const searchWhere: Prisma.MenuItemWhereInput = {
    ...(categoryName ? { category: categoryName } : {}),
    ...(query.q?.trim()
      ? {
          OR: [
            { name: { contains: query.q.trim(), mode: "insensitive" } },
            { description: { contains: query.q.trim(), mode: "insensitive" } },
            { sku: { contains: query.q.trim(), mode: "insensitive" } },
          ],
        }
      : {}),
    ...(query.tag?.trim() ? { tags: { has: query.tag.trim() } } : {}),
  };

  const statusWhere: Prisma.MenuItemWhereInput = status.has("archived")
    ? { archivedAt: { not: null } }
    : status.has("hidden")
      ? { archivedAt: null, isVisible: false }
      : status.has("soldout")
        ? { archivedAt: null, ...(soldOutIds.length ? { id: { in: soldOutIds } } : { id: { in: [] } }) }
        : status.has("available")
          ? {
              archivedAt: null,
              isVisible: true,
              ...(soldOutIds.length ? { id: { notIn: soldOutIds } } : {}),
            }
          : { archivedAt: null };

  const where: Prisma.MenuItemWhereInput = { ...searchWhere, ...statusWhere };

  const baseSearch = { ...searchWhere, archivedAt: null as null };

  const [items, total, available, soldOut, hidden, archived] = await Promise.all([
    prisma.menuItem.findMany({
      where,
      include: {
        optionGroups: { select: { id: true } },
        printStation: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      skip,
      take: pageSize,
    }),
    prisma.menuItem.count({ where }),
    prisma.menuItem.count({
      where: {
        ...baseSearch,
        isVisible: true,
        ...(soldOutIds.length ? { id: { notIn: soldOutIds } } : {}),
      },
    }),
    prisma.menuItem.count({
      where: { ...baseSearch, ...(soldOutIds.length ? { id: { in: soldOutIds } } : { id: { in: [] } }) },
    }),
    prisma.menuItem.count({ where: { ...baseSearch, isVisible: false } }),
    prisma.menuItem.count({ where: { ...searchWhere, archivedAt: { not: null } } }),
  ]);

  const ids = items.map((i) => i.id);
  const overrides = ids.length
    ? await prisma.menuItemBranchAvailability.findMany({
        where: { branchId: query.branchId, menuItemId: { in: ids } },
      })
    : [];
  const overrideMap = new Map(overrides.map((o) => [o.menuItemId, o]));

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const soldRows = ids.length
    ? await prisma.orderItem.groupBy({
        by: ["menuItemId"],
        where: {
          menuItemId: { in: ids },
          order: { branchId: query.branchId, createdAt: { gte: thirtyDaysAgo } },
        },
        _sum: { quantity: true },
      })
    : [];
  const soldMap = new Map(soldRows.map((r) => [r.menuItemId, r._sum.quantity ?? 0]));

  const rows = items.map((item) => {
    const avail = resolveAvailability(overrideMap.get(item.id) ?? null, query.timezone, !item.isAvailable);
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      price: Number(item.price),
      effectivePrice: effectiveItemPrice(item),
      thumbnail: item.thumbnailUrl || item.imageUrl,
      visibility: item.isVisible ? "visible" : "hidden",
      availability: avail,
      optionGroupCount: item.optionGroups.length,
      tags: item.tags,
      allergens: item.allergens,
      station: item.printStation,
      prepMinutes: item.prepMinutes,
      sku: item.sku,
      position: item.sortOrder,
      soldLast30Days: soldMap.get(item.id) ?? 0,
      updatedAt: item.updatedAt.toISOString(),
      archivedAt: item.archivedAt?.toISOString() ?? null,
    };
  });

  return {
    rows,
    total,
    page,
    pageSize,
    counts: { available, soldOut, hidden, archived },
  };
}
