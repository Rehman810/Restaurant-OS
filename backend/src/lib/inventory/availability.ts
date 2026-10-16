import { prisma } from "../prisma";

/** Mark menu items unavailable when recipe ingredients cannot cover one portion. */
export async function refreshMenuAvailabilityForBranch(branchId: string) {
  const settings = await prisma.storeSettings.findUnique({ where: { id: "default" } });
  if (!settings?.inventoryAutoHideMenu) return;

  const recipes = await prisma.recipeLine.findMany({
    include: { item: true },
  });
  const yields = await prisma.menuRecipe.findMany();
  const yieldMap = new Map(yields.map((y) => [y.menuItemId, y.yieldPortions || 1]));

  const stocks = await prisma.branchStock.findMany({
    where: { branchId },
  });
  const qtyMap = new Map(stocks.map((s) => [s.itemId, Number(s.quantity)]));

  const menuIds = [...new Set(recipes.map((r) => r.menuItemId))];
  for (const menuItemId of menuIds) {
    const lines = recipes.filter((r) => r.menuItemId === menuItemId);
    const portions = yieldMap.get(menuItemId) || 1;
    let ok = true;
    for (const line of lines) {
      if (!line.item.trackStock) continue;
      const need = Number(line.quantity) / portions;
      const have = qtyMap.get(line.itemId) ?? 0;
      if (have < need - 0.0001) {
        ok = false;
        break;
      }
    }
    await prisma.menuItem.update({
      where: { id: menuItemId },
      data: { isAvailable: ok },
    });
  }
}
