import { prisma } from "../prisma";
import { getStoreSettings } from "../settings-data";
import { resolveAvailability, isOrderableAvailability } from "./availability";

export async function menuItemOrderableAtBranch(
  menuItemId: string,
  branchId: string,
  item?: { isAvailable: boolean; isVisible: boolean; archivedAt: Date | null }
) {
  const menu =
    item ??
    (await prisma.menuItem.findUnique({
      where: { id: menuItemId },
      select: { isAvailable: true, isVisible: true, archivedAt: true },
    }));
  if (!menu) return false;

  const settings = await getStoreSettings();
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { timezone: true } });
  const timezone = branch?.timezone || settings.timezone || "Asia/Karachi";

  const override = await prisma.menuItemBranchAvailability.findUnique({
    where: { menuItemId_branchId: { menuItemId, branchId } },
  });

  const resolved = resolveAvailability(override, timezone, !menu.isAvailable);
  return isOrderableAvailability(resolved, menu.isVisible, menu.archivedAt != null);
}

export async function loadMenuOrderableMap(branchId: string, menuItemIds: string[]) {
  const settings = await getStoreSettings();
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { timezone: true } });
  const timezone = branch?.timezone || settings.timezone || "Asia/Karachi";

  const [items, overrides] = await Promise.all([
    prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      select: { id: true, isAvailable: true, isVisible: true, archivedAt: true },
    }),
    prisma.menuItemBranchAvailability.findMany({
      where: { branchId, menuItemId: { in: menuItemIds } },
    }),
  ]);
  const overrideMap = new Map(overrides.map((o) => [o.menuItemId, o]));
  const map = new Map<string, boolean>();
  for (const item of items) {
    const resolved = resolveAvailability(overrideMap.get(item.id) ?? null, timezone, !item.isAvailable);
    map.set(item.id, isOrderableAvailability(resolved, item.isVisible, item.archivedAt != null));
  }
  return map;
}
