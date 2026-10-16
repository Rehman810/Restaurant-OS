import { prisma } from "../prisma";
import { effectiveItemPrice } from "../store-settings";

/**
 * Theoretical dish cost uses branch weighted-average ingredient cost (BranchStock.avgCost),
 * falling back to InventoryItem.defaultCost — same basis as stock valuation and purchases (ledger).
 */
export async function buildDishCostingReport(branchId: string, categoryFilter?: string) {
  const stocks = await prisma.branchStock.findMany({
    where: { branchId },
    select: { itemId: true, avgCost: true },
  });
  const costByIngredient = new Map(
    stocks.map((s) => [s.itemId, Number(s.avgCost)])
  );

  const menuItems = await prisma.menuItem.findMany({
    where: {
      isAvailable: true,
      ...(categoryFilter ? { category: categoryFilter } : {}),
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: {
      recipeLines: { include: { item: { select: { id: true, name: true, defaultCost: true } } } },
      menuRecipe: true,
    },
  });

  return menuItems.map((menu) => {
    const price = effectiveItemPrice(menu);
    const yieldPortions = Math.max(1, menu.menuRecipe?.yieldPortions ?? 1);
    const lines = menu.recipeLines;

    if (!lines.length) {
      return {
        menuItemId: menu.id,
        name: menu.name,
        category: menu.category,
        price,
        costStatus: "unknown" as const,
        recipeCost: null,
        foodCostPercent: null,
        marginPercent: null,
        missingRecipe: true,
        missingCosts: [] as string[],
      };
    }

    let recipeCost = 0;
    const missingCosts: string[] = [];
    for (const line of lines) {
      const unit =
        costByIngredient.get(line.itemId) ??
        (line.item.defaultCost != null ? Number(line.item.defaultCost) : null);
      if (unit == null || !Number.isFinite(unit) || unit <= 0) {
        missingCosts.push(line.item.name);
        continue;
      }
      recipeCost += Number(line.quantity) * unit;
    }
    recipeCost /= yieldPortions;

    const costUnknown = missingCosts.length > 0;
    const foodCostPercent = !costUnknown && price > 0 ? (recipeCost / price) * 100 : null;
    const marginPercent =
      !costUnknown && price > 0 ? ((price - recipeCost) / price) * 100 : null;

    return {
      menuItemId: menu.id,
      name: menu.name,
      category: menu.category,
      price,
      costStatus: costUnknown ? ("partial" as const) : ("ok" as const),
      recipeCost: costUnknown ? null : Math.round(recipeCost * 100) / 100,
      foodCostPercent: foodCostPercent != null ? Math.round(foodCostPercent * 10) / 10 : null,
      marginPercent: marginPercent != null ? Math.round(marginPercent * 10) / 10 : null,
      missingRecipe: false,
      missingCosts,
    };
  });
}
