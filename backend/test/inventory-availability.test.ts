import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma";
import { refreshMenuAvailabilityForBranch } from "../src/lib/inventory/availability";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("[INV-11] inventoryAutoHideMenu", () => {
  it("hides menu items when stock cannot cover one portion", async () => {
    const branch = await prisma.branch.findFirst({ where: { isActive: true } });
    const menuItem = await prisma.menuItem.findFirst({ where: { isAvailable: true } });
    if (!branch || !menuItem) {
      console.warn("Skipping: need branch and menu item");
      return;
    }

    await prisma.storeSettings.update({
      where: { id: "default" },
      data: { inventoryAutoHideMenu: true },
    });

    const invItem = await prisma.inventoryItem.create({
      data: { name: `Avail test ${Date.now()}`, unit: "G", trackStock: true },
    });
    await prisma.branchStock.upsert({
      where: { branchId_itemId: { branchId: branch.id, itemId: invItem.id } },
      create: { branchId: branch.id, itemId: invItem.id, quantity: new Prisma.Decimal(0) },
      update: { quantity: new Prisma.Decimal(0) },
    });
    await prisma.recipeLine.deleteMany({ where: { menuItemId: menuItem.id } });
    await prisma.recipeLine.create({
      data: { menuItemId: menuItem.id, itemId: invItem.id, quantity: new Prisma.Decimal(100) },
    });
    await prisma.menuRecipe.upsert({
      where: { menuItemId: menuItem.id },
      create: { menuItemId: menuItem.id, yieldPortions: 1 },
      update: { yieldPortions: 1 },
    });

    await refreshMenuAvailabilityForBranch(branch.id);
    const hidden = await prisma.menuItem.findUnique({ where: { id: menuItem.id } });
    expect(hidden?.isAvailable).toBe(false);

    await prisma.branchStock.update({
      where: { branchId_itemId: { branchId: branch.id, itemId: invItem.id } },
      data: { quantity: new Prisma.Decimal(200) },
    });
    await refreshMenuAvailabilityForBranch(branch.id);
    const shown = await prisma.menuItem.findUnique({ where: { id: menuItem.id } });
    expect(shown?.isAvailable).toBe(true);

    await prisma.storeSettings.update({
      where: { id: "default" },
      data: { inventoryAutoHideMenu: false },
    });
    await prisma.recipeLine.deleteMany({ where: { menuItemId: menuItem.id, itemId: invItem.id } });
    await prisma.inventoryItem.delete({ where: { id: invItem.id } }).catch(() => null);
  });
});
