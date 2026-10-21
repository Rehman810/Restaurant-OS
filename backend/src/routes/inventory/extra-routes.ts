import { randomUUID } from "crypto";
import {
  InventoryUnit,
  Prisma,
  StockCountStatus,
  StockMovementType,
  StockReferenceType,
} from "@prisma/client";
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireRole } from "../../middleware/auth";
import { applyStockChange } from "../../lib/inventory/stock";
import { recipeEditorWarnings } from "../../lib/inventory/recipe-warnings";
import { suggestedReorderQty } from "../../lib/inventory/reorder";
import { countLowAndOut, needsUnitReview, stockLevel } from "../../lib/inventory/stock-status";
import { roundQty } from "../../lib/inventory/units";
import {
  assertIntegerQtyForUnit,
  purchaseToStockQty,
  purchaseUnitCostToStockCost,
} from "../../lib/inventory/validate-qty";
import { READ_ROLES, WRITE_ROLES, assertInventoryBranch, resolveBranchId } from "./shared";

export const inventoryExtraRouter = Router();

function handleErr(res: import("express").Response, err: unknown) {
  const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 500;
  return res.status(status).json({ error: err instanceof Error ? err.message : "Request failed" });
}

inventoryExtraRouter.delete("/counts/:id", requireAuth, requireRole(...WRITE_ROLES), async (req, res) => {
  try {
    const count = await prisma.stockCount.findUnique({ where: { id: req.params.id } });
    if (!count) return res.status(404).json({ error: "Count not found." });
    await assertInventoryBranch(req, count.branchId);
    if (count.status !== StockCountStatus.DRAFT) {
      return res.status(400).json({ error: "Only draft counts can be deleted." });
    }
    await prisma.stockCount.delete({ where: { id: count.id } });
    res.json({ ok: true });
  } catch (err) {
    return handleErr(res, err);
  }
});

inventoryExtraRouter.post(
  "/items/:id/convert-to-pieces",
  requireAuth,
  requireRole(...WRITE_ROLES),
  async (req, res) => {
    try {
      const branchId = await resolveBranchId(req);
      const body = req.body as { conversionFactor?: number; preview?: boolean };
      const factor = Number(body.conversionFactor ?? 0);
      if (!Number.isFinite(factor) || factor <= 0) {
        return res.status(400).json({ error: "conversionFactor must be a positive number." });
      }
      const item = await prisma.inventoryItem.findUnique({ where: { id: req.params.id } });
      if (!item) return res.status(404).json({ error: "Item not found." });
      if (item.unit !== InventoryUnit.PACK) {
        return res.status(400).json({ error: "Convert to pieces applies to PACK stock units." });
      }
      const stock = await prisma.branchStock.findUnique({
        where: { branchId_itemId: { branchId, itemId: item.id } },
      });
      const oldQty = Number(stock?.quantity ?? 0);
      const oldAvg = Number(stock?.avgCost ?? item.defaultCost);
      const newQty = roundQty(oldQty * factor);
      const newAvg = oldQty > 0 ? roundQty(oldAvg / factor) : oldAvg;
      const preview = {
        oldUnit: item.unit,
        newUnit: InventoryUnit.PIECE,
        oldQty,
        newQty,
        oldAvgCost: oldAvg,
        newAvgCost: newAvg,
        oldValue: roundQty(oldQty * oldAvg),
        newValue: roundQty(newQty * newAvg),
      };
      if (body.preview) return res.json({ preview });
      await prisma.inventoryItem.update({
        where: { id: item.id },
        data: {
          unit: InventoryUnit.PIECE,
          purchaseUnit: InventoryUnit.PACK,
          conversionFactor: factor,
        },
      });
      if (stock) {
        await prisma.branchStock.update({
          where: { id: stock.id },
          data: { quantity: newQty, avgCost: newAvg },
        });
      }
      await applyStockChange({
        branchId,
        itemId: item.id,
        type: StockMovementType.ADJUSTMENT,
        quantityDelta: 0,
        reason: `Converted from PACK to PIECE (×${factor})`,
        notes: `Qty ${oldQty} packs → ${newQty} pieces; avg ${oldAvg} → ${newAvg}`,
        actorId: req.user!.id,
        referenceType: StockReferenceType.ADJUSTMENT,
      });
      res.json({ ok: true, preview });
    } catch (err) {
      return handleErr(res, err);
    }
  }
);

inventoryExtraRouter.get("/suppliers/:id/ledger", requireAuth, requireRole(...READ_ROLES), async (req, res) => {
  try {
    const branchId = await resolveBranchId(req);
    const supplierId = req.params.id;
    const [purchases, payments] = await Promise.all([
      prisma.inventoryPurchase.findMany({
        where: { branchId, supplierId, voidedAt: null },
        orderBy: { purchaseDate: "desc" },
        take: 100,
      }),
      prisma.supplierPayment.findMany({
        where: { branchId, supplierId },
        orderBy: { paidAt: "desc" },
        take: 100,
      }),
    ]);
    const purchaseTotal = purchases.reduce((s, p) => s + Number(p.total), 0);
    const paidOnPurchases = purchases.reduce((s, p) => s + Number(p.paidAmount), 0);
    const paymentsTotal = payments.reduce((s, p) => s + Number(p.amount), 0);
    const balanceDue = roundQty(purchaseTotal - paidOnPurchases - paymentsTotal);
    res.json({
      purchases: purchases.map((p) => ({
        id: p.id,
        purchaseDate: p.purchaseDate.toISOString(),
        invoiceRef: p.invoiceRef,
        total: Number(p.total),
        paidAmount: Number(p.paidAmount),
        paymentStatus: p.paymentStatus,
      })),
      payments: payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        method: p.method,
        paidAt: p.paidAt.toISOString(),
        reference: p.reference,
      })),
      balanceDue,
    });
  } catch (err) {
    return handleErr(res, err);
  }
});

inventoryExtraRouter.post(
  "/suppliers/:id/payments",
  requireAuth,
  requireRole(...WRITE_ROLES),
  async (req, res) => {
    try {
      const branchId = await resolveBranchId(req);
      const body = req.body as { amount?: number; method?: string; paidAt?: string; reference?: string; notes?: string };
      const amount = Number(body.amount ?? 0);
      if (amount <= 0) return res.status(400).json({ error: "Payment amount must be positive." });
      const payment = await prisma.supplierPayment.create({
        data: {
          id: randomUUID(),
          supplierId: req.params.id,
          branchId,
          amount,
          method: (body.method || "CASH").trim(),
          paidAt: body.paidAt ? new Date(body.paidAt) : new Date(),
          reference: body.reference?.trim() || null,
          notes: body.notes?.trim() || null,
          createdById: req.user!.id,
        },
      });
      const { writeAuditSafe } = await import("../../lib/audit");
      const { AuditAction } = await import("../../lib/audit-actions");
      await writeAuditSafe(prisma, {
        actorId: req.user!.id,
        actorRole: req.user!.role,
        branchId,
        action: AuditAction.SUPPLIER_PAYMENT_RECORDED,
        entityType: "supplier",
        entityId: req.params.id,
        after: { amount, method: payment.method, paymentId: payment.id },
      });
      res.status(201).json({ payment });
    } catch (err) {
      return handleErr(res, err);
    }
  }
);

inventoryExtraRouter.get("/reports/theoretical-actual", requireAuth, requireRole(...READ_ROLES), async (req, res) => {
  try {
    const branchId = await resolveBranchId(req);
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 30 * 86400000);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    const counts = await prisma.stockCount.findMany({
      where: { branchId, status: StockCountStatus.APPROVED, approvedAt: { not: null } },
      orderBy: { approvedAt: "asc" },
    });
    if (counts.length < 2) {
      return res.json({
        rows: [],
        message: "Need two approved stock counts in this period to compare usage.",
      });
    }
    const open = counts[0];
    const close = counts[counts.length - 1];
    const openLines = await prisma.stockCountLine.findMany({ where: { countId: open.id } });
    const closeLines = await prisma.stockCountLine.findMany({ where: { countId: close.id } });
    const openMap = new Map(openLines.map((l) => [l.itemId, Number(l.countedQty ?? l.systemQty)]));
    const closeMap = new Map(closeLines.map((l) => [l.itemId, Number(l.countedQty ?? l.systemQty)]));
    const itemIds = new Set([...openMap.keys(), ...closeMap.keys()]);
    const items = await prisma.inventoryItem.findMany({ where: { id: { in: [...itemIds] } } });
    const itemMap = new Map(items.map((i) => [i.id, i]));

    const rows = [];
    for (const itemId of itemIds) {
      const item = itemMap.get(itemId);
      if (!item) continue;
      const opening = openMap.get(itemId) ?? 0;
      const closing = closeMap.get(itemId) ?? 0;
      const purchases = await prisma.stockMovement.aggregate({
        where: {
          branchId,
          itemId,
          type: StockMovementType.PURCHASE,
          createdAt: { gte: open.approvedAt!, lte: close.approvedAt! },
        },
        _sum: { quantityDelta: true },
      });
      const sales = await prisma.stockMovement.aggregate({
        where: {
          branchId,
          itemId,
          type: { in: [StockMovementType.SALE_DEDUCTION, StockMovementType.SALE] },
          createdAt: { gte: open.approvedAt!, lte: close.approvedAt! },
        },
        _sum: { quantityDelta: true },
      });
      const waste = await prisma.stockMovement.aggregate({
        where: {
          branchId,
          itemId,
          type: StockMovementType.WASTE,
          createdAt: { gte: open.approvedAt!, lte: close.approvedAt! },
        },
        _sum: { quantityDelta: true },
      });
      const purchased = Number(purchases._sum.quantityDelta ?? 0);
      const theoretical = -Number(sales._sum.quantityDelta ?? 0);
      const wasted = -Number(waste._sum.quantityDelta ?? 0);
      const actual = opening + purchased - closing - wasted;
      const varianceQty = roundQty(actual - theoretical);
      const stock = await prisma.branchStock.findUnique({ where: { branchId_itemId: { branchId, itemId } } });
      const avg = Number(stock?.avgCost ?? item.defaultCost);
      rows.push({
        itemId,
        name: item.name,
        unit: item.unit,
        theoretical,
        actual,
        varianceQty,
        varianceCost: roundQty(varianceQty * avg),
      });
    }
    rows.sort((a, b) => Math.abs(b.varianceCost) - Math.abs(a.varianceCost));
    res.json({ rows, from: from.toISOString(), to: to.toISOString() });
  } catch (err) {
    return handleErr(res, err);
  }
});

export function enrichRecipeResponse(
  econ: {
    foodCostPercent: number | null;
    recipeCostDisplay?: number | null;
    marginPercent: number | null;
    status: string;
    missingIngredients: string[];
  },
  lines: { quantity: number }[],
  existingWarning: string | null
) {
  const extra = recipeEditorWarnings({
    foodCostPercent: econ.foodCostPercent,
    ingredientCount: lines.length,
  });
  const costWarning = existingWarning || extra[0] || null;
  return { costWarning, recipeWarnings: extra };
}

export { suggestedReorderQty, countLowAndOut, needsUnitReview, stockLevel };
