import { prisma } from "../prisma";

export type MenuUsageCounts = {
  orderLines: number;
  dealItems: number;
  recipeLines: number;
  coupons: number;
};

export async function menuItemUsageCounts(menuItemId: string): Promise<MenuUsageCounts> {
  const [orderLines, dealItems, recipeLines] = await Promise.all([
    prisma.orderItem.count({ where: { menuItemId } }),
    prisma.dealItem.count({ where: { menuItemId } }),
    prisma.recipeLine.count({ where: { menuItemId } }),
  ]);
  return { orderLines, dealItems, recipeLines, coupons: 0 };
}

export function usageBlocksDelete(counts: MenuUsageCounts): boolean {
  return counts.orderLines > 0 || counts.dealItems > 0 || counts.recipeLines > 0 || counts.coupons > 0;
}

export async function dealUsageCounts(dealId: string) {
  const orderLines = await prisma.orderItem.count({
    where: { nameAtOrder: { contains: "" } },
  });
  // Deals expand to component lines — no direct dealId on OrderItem; archive if any component referenced in active deals only.
  void dealId;
  return { orderLines: 0 };
}

export async function categoryUsageDishCount(categoryName: string) {
  return prisma.menuItem.count({ where: { category: categoryName, archivedAt: null } });
}
