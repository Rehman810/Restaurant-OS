import { prisma } from "../prisma";
import { effectiveItemPrice } from "../store-settings";

export type MenuRecipeCostInfo = {
  unitCost: number | null;
  costKnown: boolean;
  marginPercent: number | null;
  foodCostPercent: number | null;
};

/**
 * Per-portion recipe cost for menu items (branch avg ingredient cost, else defaultCost).
 */
export async function recipeUnitCostByMenuId(
  branchId: string | null,
  menuItemIds: string[]
): Promise<Map<string, MenuRecipeCostInfo>> {
  const out = new Map<string, MenuRecipeCostInfo>();
  const ids = [...new Set(menuItemIds.filter(Boolean))];
  if (!ids.length) return out;

  const costByIngredient = new Map<string, number>();
  if (branchId) {
    const stocks = await prisma.branchStock.findMany({
      where: { branchId },
      select: { itemId: true, avgCost: true },
    });
    for (const s of stocks) costByIngredient.set(s.itemId, Number(s.avgCost));
  }

  const menus = await prisma.menuItem.findMany({
    where: { id: { in: ids } },
    include: {
      recipeLines: { include: { item: { select: { id: true, defaultCost: true } } } },
      menuRecipe: true,
    },
  });

  for (const menu of menus) {
    const price = effectiveItemPrice(menu);
    const yieldPortions = Math.max(1, menu.menuRecipe?.yieldPortions ?? 1);
    if (!menu.recipeLines.length) {
      out.set(menu.id, { unitCost: null, costKnown: false, marginPercent: null, foodCostPercent: null });
      continue;
    }
    let recipeCost = 0;
    let missing = false;
    for (const line of menu.recipeLines) {
      const unit =
        costByIngredient.get(line.itemId) ??
        (line.item.defaultCost != null ? Number(line.item.defaultCost) : null);
      if (unit == null || !Number.isFinite(unit) || unit <= 0) {
        missing = true;
        continue;
      }
      recipeCost += Number(line.quantity) * unit;
    }
    recipeCost /= yieldPortions;
    if (missing) {
      out.set(menu.id, { unitCost: null, costKnown: false, marginPercent: null, foodCostPercent: null });
    } else {
      const unitCost = Math.round(recipeCost * 100) / 100;
      const foodCostPercent = price > 0 ? Math.round((recipeCost / price) * 1000) / 10 : null;
      const marginPercent = price > 0 ? Math.round(((price - recipeCost) / price) * 1000) / 10 : null;
      out.set(menu.id, { unitCost, costKnown: true, marginPercent, foodCostPercent });
    }
  }
  return out;
}
