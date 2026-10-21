import { Prisma, StockMovementType, StockReferenceType } from "@prisma/client";
import { prisma } from "../prisma";
import { maybeEmitStockAlerts } from "./stock-notify";
import { roundQty, weightedAverageCost } from "./units";

export type LedgerInput = {
  branchId: string;
  itemId: string;
  type: StockMovementType;
  quantityDelta: number;
  unitCost?: number;
  reason?: string;
  reference?: string;
  referenceType?: StockReferenceType;
  referenceId?: string;
  notes?: string;
  actorId?: string;
  orderId?: string;
  purchaseLineId?: string;
  wasteLogId?: string;
  allowNegative?: boolean;
  /** On purchase: update branch weighted average cost */
  updateAvgCost?: boolean;
  /** Create FEFO batch row */
  batchExpiry?: Date | null;
  purchaseLineIdForBatch?: string;
};

async function inventorySettings() {
  const s = await prisma.storeSettings.findUnique({ where: { id: "default" } });
  return {
    allowNegative: s?.inventoryAllowNegative ?? false,
  };
}

type DbClient = Prisma.TransactionClient | typeof prisma;

export async function getOrCreateBranchStock(branchId: string, itemId: string, tx?: DbClient) {
  const db = tx ?? prisma;
  const existing = await db.branchStock.findUnique({
    where: { branchId_itemId: { branchId, itemId } },
  });
  if (existing) return existing;
  return db.branchStock.create({
    data: { branchId, itemId, quantity: new Prisma.Decimal(0), avgCost: new Prisma.Decimal(0) },
  });
}

type StockChangeResult = {
  movement: Awaited<ReturnType<typeof prisma.stockMovement.create>>;
  oldQty: number;
  newQty: number;
  itemName: string;
  unit: string;
  reorderPoint: number;
};

/** Single entry point for all stock mutations — always writes a movement row. */
export async function applyStockChange(input: LedgerInput) {
  const settings = await inventorySettings();
  const allowNegative = input.allowNegative ?? settings.allowNegative;

  const result = await prisma.$transaction(async (tx): Promise<StockChangeResult | null> => {
    const item = await tx.inventoryItem.findFirst({
      where: { id: input.itemId, isActive: true },
    });
    if (!item) throw Object.assign(new Error("Inventory item not found."), { status: 404 });
    if (!item.trackStock && input.type !== StockMovementType.PURCHASE) {
      return null;
    }

    const stock = await getOrCreateBranchStock(
      input.branchId,
      input.itemId,
      tx as unknown as Prisma.TransactionClient
    );
    await tx.$executeRaw`
      SELECT id FROM "BranchStock" WHERE id = ${stock.id} FOR UPDATE
    `;
    const oldQty = Number(stock.quantity);
    const oldAvg = Number(stock.avgCost);
    const delta = roundQty(input.quantityDelta);
    const nextQty = roundQty(oldQty + delta);

    if (!allowNegative && nextQty < -0.0001) {
      throw Object.assign(new Error(`Not enough stock for ${item.name}.`), {
        status: 409,
        code: "INSUFFICIENT_STOCK",
      });
    }
    const clampedQty = allowNegative ? nextQty : Math.max(0, nextQty);

    let newAvg = oldAvg;
    if (input.updateAvgCost && delta > 0 && input.unitCost != null) {
      newAvg = weightedAverageCost(oldQty, oldAvg, delta, input.unitCost);
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { defaultCost: new Prisma.Decimal(newAvg) },
      });
      if (input.type === "PURCHASE" && oldAvg > 0 && newAvg !== oldAvg) {
        void import("../costing/price-alert").then(({ maybeNotifyIngredientCostChange }) =>
          maybeNotifyIngredientCostChange({
            branchId: input.branchId,
            itemId: input.itemId,
            itemName: item.name,
            oldAvg,
            newAvg,
          }).catch((err) => console.error("[costing] price alert failed", err))
        );
      }
    }

    if (delta < 0 && item.trackExpiry) {
      await consumeBatchesFefo(tx as unknown as Prisma.TransactionClient, input.branchId, input.itemId, -delta);
    }

    if (delta > 0 && item.trackExpiry && input.batchExpiry) {
      await tx.stockBatch.create({
        data: {
          branchId: input.branchId,
          itemId: input.itemId,
          purchaseLineId: input.purchaseLineIdForBatch ?? input.purchaseLineId ?? null,
          quantityRemaining: new Prisma.Decimal(delta),
          expiryDate: input.batchExpiry,
        },
      });
    }

    const movement = await tx.stockMovement.create({
      data: {
        branchId: input.branchId,
        itemId: input.itemId,
        type: input.type,
        quantityDelta: new Prisma.Decimal(delta),
        quantityAfter: new Prisma.Decimal(clampedQty),
        unitCost: input.unitCost != null ? new Prisma.Decimal(input.unitCost) : null,
        reason: input.reason,
        reference: input.reference,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        notes: input.notes,
        actorId: input.actorId,
        orderId: input.orderId,
        purchaseLineId: input.purchaseLineId,
        wasteLogId: input.wasteLogId,
      },
    });

    await tx.branchStock.update({
      where: { id: stock.id },
      data: {
        quantity: new Prisma.Decimal(clampedQty),
        ...(input.updateAvgCost && delta > 0 ? { avgCost: new Prisma.Decimal(newAvg) } : {}),
      },
    });

    return {
      movement,
      oldQty,
      newQty: clampedQty,
      itemName: item.name,
      unit: item.unit,
      reorderPoint: Number(item.reorderPoint),
    };
  });

  if (result) {
    maybeEmitStockAlerts({
      branchId: input.branchId,
      itemId: input.itemId,
      itemName: result.itemName,
      unit: result.unit,
      reorderPoint: result.reorderPoint,
      oldQty: result.oldQty,
      newQty: result.newQty,
    });
    return result.movement;
  }
  return null;
}

async function consumeBatchesFefo(
  tx: DbClient,
  branchId: string,
  itemId: string,
  qty: number
) {
  let remaining = qty;
  const batches = await tx.stockBatch.findMany({
    where: { branchId, itemId, quantityRemaining: { gt: 0 } },
    orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
  });
  for (const b of batches) {
    if (remaining <= 0) break;
    const have = Number(b.quantityRemaining);
    const take = Math.min(have, remaining);
    await tx.stockBatch.update({
      where: { id: b.id },
      data: { quantityRemaining: new Prisma.Decimal(have - take) },
    });
    remaining -= take;
  }
}

export async function expiringBatches(branchId: string, withinDays = 7) {
  const until = new Date();
  until.setDate(until.getDate() + withinDays);
  return prisma.stockBatch.findMany({
    where: {
      branchId,
      quantityRemaining: { gt: 0 },
      expiryDate: { lte: until },
    },
    include: { item: { select: { name: true, unit: true } } },
    orderBy: { expiryDate: "asc" },
  });
}
