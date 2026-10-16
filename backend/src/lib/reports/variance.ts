import { OrderStatus, StockCountStatus, StockMovementType } from "@prisma/client";
import { prisma } from "../prisma";

/** Expected usage from recipes × sold qty vs opening + purchases − closing − waste. */
export async function buildVarianceReport(branchId: string, startUtc: Date, endUtc: Date) {
  const approvedCounts = await prisma.stockCount.findMany({
    where: {
      branchId,
      status: StockCountStatus.APPROVED,
      approvedAt: { gte: startUtc, lte: endUtc },
    },
    include: { lines: true },
    orderBy: { approvedAt: "asc" },
  });

  if (approvedCounts.length < 2) {
    return {
      hasCounts: false,
      note: "Variance needs at least two approved stock counts in the selected period (opening and closing).",
      ingredients: [] as unknown[],
    };
  }

  const opening = approvedCounts[0];
  const closing = approvedCounts[approvedCounts.length - 1];
  const openingQty = new Map(opening.lines.map((l) => [l.itemId, Number(l.countedQty)]));
  const closingQty = new Map(closing.lines.map((l) => [l.itemId, Number(l.countedQty)]));

  const purchases = await prisma.stockMovement.groupBy({
    by: ["itemId"],
    where: {
      branchId,
      type: StockMovementType.PURCHASE,
      createdAt: { gte: startUtc, lte: endUtc },
    },
    _sum: { quantityDelta: true },
  });
  const purchaseMap = new Map(purchases.map((p) => [p.itemId, Number(p._sum.quantityDelta ?? 0)]));

  const waste = await prisma.stockMovement.groupBy({
    by: ["itemId"],
    where: {
      branchId,
      type: StockMovementType.WASTE,
      createdAt: { gte: startUtc, lte: endUtc },
    },
    _sum: { quantityDelta: true },
  });
  const wasteMap = new Map(waste.map((w) => [w.itemId, Math.abs(Number(w._sum.quantityDelta ?? 0))]));

  const recipes = await prisma.recipeLine.findMany({
    include: { item: { select: { id: true, name: true, unit: true } } },
  });
  const yields = await prisma.menuRecipe.findMany();
  const yieldByMenu = new Map(yields.map((y) => [y.menuItemId, Math.max(1, y.yieldPortions)]));

  const sold = await prisma.orderItem.findMany({
    where: {
      order: {
        branchId,
        status: { not: OrderStatus.CANCELLED },
        createdAt: { gte: startUtc, lte: endUtc },
      },
    },
    select: { menuItemId: true, quantity: true },
  });

  const expectedUse = new Map<string, number>();
  for (const line of sold) {
    const portion = yieldByMenu.get(line.menuItemId) ?? 1;
    const lines = recipes.filter((r) => r.menuItemId === line.menuItemId);
    for (const r of lines) {
      const add = (Number(r.quantity) / portion) * line.quantity;
      expectedUse.set(r.itemId, (expectedUse.get(r.itemId) ?? 0) + add);
    }
  }

  const itemIds = new Set([
    ...openingQty.keys(),
    ...closingQty.keys(),
    ...purchaseMap.keys(),
    ...expectedUse.keys(),
  ]);

  const stocks = await prisma.branchStock.findMany({
    where: { branchId, itemId: { in: [...itemIds] } },
    include: { item: true },
  });
  const costMap = new Map(stocks.map((s) => [s.itemId, Number(s.avgCost || s.item.defaultCost)]));

  const ingredients = [...itemIds].map((itemId) => {
    const open = openingQty.get(itemId) ?? 0;
    const close = closingQty.get(itemId) ?? 0;
    const purchased = purchaseMap.get(itemId) ?? 0;
    const wasted = wasteMap.get(itemId) ?? 0;
    const expected = expectedUse.get(itemId) ?? 0;
    const actualUse = open + purchased - close - wasted;
    const varianceQty = actualUse - expected;
    const unitCost = costMap.get(itemId) ?? 0;
    const item = stocks.find((s) => s.itemId === itemId)?.item;
    return {
      itemId,
      name: item?.name ?? itemId,
      unit: item?.unit ?? "PIECE",
      opening: open,
      purchases: purchased,
      closing: close,
      waste: wasted,
      expectedUsage: Math.round(expected * 1000) / 1000,
      actualUsage: Math.round(actualUse * 1000) / 1000,
      varianceQty: Math.round(varianceQty * 1000) / 1000,
      varianceValue: Math.round(varianceQty * unitCost * 100) / 100,
    };
  });

  ingredients.sort((a, b) => Math.abs(b.varianceValue) - Math.abs(a.varianceValue));

  return {
    hasCounts: true,
    openingCountId: opening.id,
    closingCountId: closing.id,
    note: null,
    ingredients,
  };
}
