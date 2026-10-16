import { OrderStatus, StockMovementType, StockReferenceType } from "@prisma/client";
import { prisma } from "../prisma";
import { applyStockChange } from "./ledger";
import { refreshMenuAvailabilityForBranch } from "./availability";

const DEDUCT_TYPES = [StockMovementType.SALE, StockMovementType.SALE_DEDUCTION];

export async function deductInventoryForOrder(orderId: string, actorId?: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order || order.inventoryDeductedAt) return { skipped: true as const };
  const branchId = order.branchId;
  if (!branchId) return { skipped: true as const };

  const settings = await prisma.storeSettings.findUnique({ where: { id: "default" } });
  if (settings && !settings.inventoryDeductAtPreparing) return { skipped: true as const };

  const menuIds = [...new Set(order.items.map((i) => i.menuItemId))];
  const [recipes, yields] = await Promise.all([
    prisma.recipeLine.findMany({
      where: { menuItemId: { in: menuIds } },
      include: { item: true },
    }),
    prisma.menuRecipe.findMany({ where: { menuItemId: { in: menuIds } } }),
  ]);
  if (!recipes.length) {
    await prisma.order.update({
      where: { id: orderId },
      data: { inventoryDeductedAt: new Date() },
    });
    return { skipped: true as const, reason: "no_recipes" as const };
  }

  const yieldMap = new Map(yields.map((y) => [y.menuItemId, y.yieldPortions || 1]));
  const need = new Map<string, number>();
  for (const line of order.items) {
    const portions = yieldMap.get(line.menuItemId) || 1;
    const lines = recipes.filter((r) => r.menuItemId === line.menuItemId);
    for (const r of lines) {
      const perPortion = Number(r.quantity) / portions;
      const key = r.itemId;
      need.set(key, (need.get(key) || 0) + perPortion * line.quantity);
    }
  }

  for (const [itemId, qty] of need) {
    if (qty <= 0) continue;
    const existing = await prisma.stockMovement.findFirst({
      where: { orderId, itemId, type: { in: DEDUCT_TYPES } },
    });
    if (existing) continue;

    try {
      await applyStockChange({
        branchId,
        itemId,
        type: StockMovementType.SALE_DEDUCTION,
        quantityDelta: -qty,
        reference: order.orderNumber,
        referenceType: StockReferenceType.ORDER,
        referenceId: orderId,
        notes: `Order ${order.orderNumber}`,
        actorId,
        orderId,
      });
    } catch (e) {
      const code = typeof e === "object" && e && "code" in e ? (e as { code: string }).code : "";
      if (code === "INSUFFICIENT_STOCK") {
        /* still mark deducted attempt — kitchen may proceed; availability handles menu */
      } else {
        throw e;
      }
    }
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { inventoryDeductedAt: new Date() },
  });

  await refreshMenuAvailabilityForBranch(branchId);
  return { skipped: false as const };
}

export async function reverseInventoryForOrder(orderId: string, actorId?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order?.inventoryDeductedAt || !order.branchId) return { skipped: true as const };

  const movements = await prisma.stockMovement.findMany({
    where: { orderId, type: { in: DEDUCT_TYPES } },
  });
  for (const m of movements) {
    const reversed = await prisma.stockMovement.findFirst({
      where: {
        referenceType: StockReferenceType.ORDER,
        referenceId: orderId,
        itemId: m.itemId,
        type: StockMovementType.REVERSAL,
      },
    });
    if (reversed) continue;
    await applyStockChange({
      branchId: order.branchId,
      itemId: m.itemId,
      type: StockMovementType.REVERSAL,
      quantityDelta: -Number(m.quantityDelta),
      unitCost: m.unitCost != null ? Number(m.unitCost) : undefined,
      reference: order.orderNumber,
      referenceType: StockReferenceType.ORDER,
      referenceId: orderId,
      notes: `Reversal order ${order.orderNumber}`,
      actorId,
      orderId,
    });
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { inventoryDeductedAt: null },
  });
  await refreshMenuAvailabilityForBranch(order.branchId);
  return { skipped: false as const };
}

export function shouldDeductOnStatus(status: OrderStatus) {
  return status === OrderStatus.PREPARING || status === OrderStatus.CONFIRMED;
}
