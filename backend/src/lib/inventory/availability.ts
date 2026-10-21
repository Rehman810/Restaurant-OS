import { SoldOutUntilKind } from "@prisma/client";
import { prisma } from "../prisma";
import { getStoreSettings } from "../settings-data";
import { notifyMenuBackInStock, notifyMenuSoldOut } from "../notifications/ops";
import { emitMenuCatalogChanged } from "../realtime";

/** Mark menu items sold out at a branch when recipe ingredients cannot cover one portion. */
export async function refreshMenuAvailabilityForBranch(branchId: string) {
  const settings = await prisma.storeSettings.findUnique({ where: { id: "default" } });
  if (!settings?.inventoryAutoHideMenu) return;

  const storeSettings = await getStoreSettings();
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { timezone: true } });
  const timezone = branch?.timezone || storeSettings.timezone || "Asia/Karachi";

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
  const menuNames = await prisma.menuItem.findMany({
    where: { id: { in: menuIds } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(menuNames.map((m) => [m.id, m.name]));

  const priorAuto = await prisma.menuItemBranchAvailability.findMany({
    where: { branchId, menuItemId: { in: menuIds }, reason: "auto_inventory" },
    select: { menuItemId: true, soldOut: true },
  });
  const priorAutoIds = new Set(priorAuto.filter((p) => p.soldOut).map((p) => p.menuItemId));

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
    if (!ok) {
      await prisma.menuItemBranchAvailability.upsert({
        where: { menuItemId_branchId: { menuItemId, branchId } },
        create: {
          menuItemId,
          branchId,
          soldOut: true,
          untilKind: SoldOutUntilKind.INDEFINITE,
          reason: "auto_inventory",
        },
        update: {
          soldOut: true,
          untilKind: SoldOutUntilKind.INDEFINITE,
          reason: "auto_inventory",
          setAt: new Date(),
        },
      });
      if (!priorAutoIds.has(menuItemId)) {
        const name = nameMap.get(menuItemId) ?? "Menu item";
        notifyMenuSoldOut({ branchId, menuItemId, name, reason: "auto_inventory" });
      }
    } else {
      const removed = await prisma.menuItemBranchAvailability.deleteMany({
        where: { menuItemId, branchId, reason: "auto_inventory" },
      });
      if (removed.count > 0) {
        const name = nameMap.get(menuItemId) ?? "Menu item";
        notifyMenuBackInStock({ branchId, menuItemId, name });
      }
    }
  }

  emitMenuCatalogChanged([branchId]);
  void timezone;
}
