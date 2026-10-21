import { prisma } from "../prisma";
import { buildDishEconomics } from "../costing/compute";
import { costingSettingsFromStore } from "../costing/math";
import { getStoreSettings } from "../settings-data";

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

  const settingsRow = await getStoreSettings();
  const settings = costingSettingsFromStore(settingsRow);

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
      recipeLines: { include: { item: { select: { id: true, name: true, unit: true, defaultCost: true } } } },
      menuRecipe: true,
    },
  });

  for (const menu of menus) {
    const yieldPortions = Math.max(1, menu.menuRecipe?.yieldPortions ?? 1);
    const econ = buildDishEconomics(menu, menu.recipeLines, costByIngredient, yieldPortions, settings, null);
    const costKnown = econ.status === "COMPLETE" || econ.status === "SUSPICIOUS_LOW";
    if (!costKnown) {
      out.set(menu.id, { unitCost: null, costKnown: false, marginPercent: null, foodCostPercent: null });
      continue;
    }
    out.set(menu.id, {
      unitCost: econ.recipeCostDisplay,
      costKnown: true,
      marginPercent: econ.marginPercent,
      foodCostPercent: econ.foodCostPercent,
    });
  }
  return out;
}
