import { Router } from "express";
import {
  InventoryUnit,
  Prisma,
  PurchasePaymentStatus,
  PurchaseStatus,
  StockCountStatus,
  StockMovementType,
  StockReferenceType,
  TransferStatus,
  WasteReason,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireRole } from "../../middleware/auth";
import { branchScopeError } from "../../lib/branch-scope";
import { applyStockChange, expiringBatches, lowStockForBranch } from "../../lib/inventory/stock";
import { roundQty } from "../../lib/inventory/units";
import { READ_ROLES, WRITE_ROLES, itemStatus, resolveBranchId } from "./shared";

export const inventoryRouter = Router();

function handleErr(res: import("express").Response, err: unknown) {
  const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 500;
  return res.status(status).json({ error: err instanceof Error ? err.message : "Request failed" });
}

inventoryRouter.get("/summary", requireAuth, requireRole(...READ_ROLES), async (req, res) => {
  try {
    const branchId = await resolveBranchId(req);
    const expiring = await expiringBatches(branchId, 7);
    const expiringItemIds = new Set(expiring.map((b) => b.itemId));

    const items = await prisma.inventoryItem.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: {
        branchStocks: { where: { branchId } },
        categoryRef: true,
      },
    });

    const rows = items.map((i) => {
      const qty = Number(i.branchStocks[0]?.quantity ?? 0);
      const avg = Number(i.branchStocks[0]?.avgCost ?? i.defaultCost);
      return {
        id: i.id,
        sku: i.sku,
        name: i.name,
        category: i.categoryRef?.name ?? i.category,
        categoryId: i.categoryId,
        unit: i.unit,
        reorderPoint: Number(i.reorderPoint),
        parLevel: i.parLevel != null ? Number(i.parLevel) : null,
        defaultCost: Number(i.defaultCost),
        avgCost: avg,
        trackStock: i.trackStock,
        trackExpiry: i.trackExpiry,
        isActive: i.isActive,
        quantity: qty,
        stockValue: roundQty(qty * avg),
        status: itemStatus(qty, Number(i.reorderPoint), expiringItemIds.has(i.id)),
      };
    });

    const lowStock = await lowStockForBranch(branchId);
    const outCount = rows.filter((r) => r.status === "out").length;
    const lowCount = rows.filter((r) => r.status === "low").length;
    const totalValue = rows.reduce((s, r) => s + r.stockValue, 0);

    const movements = await prisma.stockMovement.findMany({
      where: { branchId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        item: { select: { name: true, unit: true } },
      },
    });

    res.json({
      metrics: {
        totalItems: rows.length,
        totalValue,
        lowCount,
        outCount,
      },
      items: rows,
      lowStock,
      movements: movements.map((m) => ({
        id: m.id,
        type: m.type,
        itemName: m.item.name,
        unit: m.item.unit,
        quantityDelta: Number(m.quantityDelta),
        quantityAfter: Number(m.quantityAfter),
        reason: m.reason,
        reference: m.reference,
        referenceType: m.referenceType,
        referenceId: m.referenceId,
        notes: m.notes,
        actorId: m.actorId,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return branchScopeError(res, err);
  }
});

inventoryRouter.get("/items", requireAuth, requireRole(...READ_ROLES), async (req, res) => {
  try {
    const branchId = await resolveBranchId(req);
    const q = String(req.query.q || "").trim().toLowerCase();
    const category = String(req.query.category || "").trim();
    const statusFilter = String(req.query.status || "all");
    const showArchived = req.query.archived === "1";
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(10, Number(req.query.pageSize) || 50));

    const expiring = await expiringBatches(branchId, 7);
    const expiringItemIds = new Set(expiring.map((b) => b.itemId));

    const where: Prisma.InventoryItemWhereInput = {
      isActive: showArchived ? undefined : true,
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      ...(category ? { OR: [{ category }, { categoryRef: { name: category } }] } : {}),
    };

    const items = await prisma.inventoryItem.findMany({
      where,
      include: { branchStocks: { where: { branchId } }, categoryRef: true },
      orderBy: { name: "asc" },
    });

    let rows = items.map((i) => {
      const qty = Number(i.branchStocks[0]?.quantity ?? 0);
      const avg = Number(i.branchStocks[0]?.avgCost ?? i.defaultCost);
      const st = itemStatus(qty, Number(i.reorderPoint), expiringItemIds.has(i.id));
      return {
        id: i.id,
        sku: i.sku,
        name: i.name,
        category: i.categoryRef?.name ?? i.category,
        categoryId: i.categoryId,
        unit: i.unit,
        reorderPoint: Number(i.reorderPoint),
        parLevel: i.parLevel != null ? Number(i.parLevel) : null,
        avgCost: avg,
        quantity: qty,
        stockValue: roundQty(qty * avg),
        trackStock: i.trackStock,
        trackExpiry: i.trackExpiry,
        isActive: i.isActive,
        status: st,
      };
    });

    if (statusFilter === "low") rows = rows.filter((r) => r.status === "low");
    if (statusFilter === "out") rows = rows.filter((r) => r.status === "out");
    if (statusFilter === "expiring") rows = rows.filter((r) => r.status === "expiring");

    const total = rows.length;
    const slice = rows.slice((page - 1) * pageSize, page * pageSize);
    res.json({ items: slice, total, page, pageSize });
  } catch (err) {
    return branchScopeError(res, err);
  }
});

inventoryRouter.get("/categories", requireAuth, requireRole(...READ_ROLES), async (_req, res) => {
  const categories = await prisma.ingredientCategory.findMany({ orderBy: { sortOrder: "asc" } });
  res.json({ categories });
});

inventoryRouter.post("/categories", requireAuth, requireRole(...WRITE_ROLES), async (req, res) => {
  const name = String((req.body as { name?: string }).name || "").trim();
  if (!name) return res.status(400).json({ error: "Category name is required." });
  try {
    const cat = await prisma.ingredientCategory.create({ data: { name } });
    res.status(201).json({ category: cat });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return res.status(409).json({ error: "Category already exists." });
    }
    throw e;
  }
});

inventoryRouter.post("/items", requireAuth, requireRole(...WRITE_ROLES), async (req, res) => {
  const body = req.body as {
    name?: string;
    sku?: string;
    category?: string;
    categoryId?: string;
    unit?: InventoryUnit;
    reorderPoint?: number;
    parLevel?: number;
    defaultCost?: number;
    trackStock?: boolean;
    trackExpiry?: boolean;
    openingStock?: number;
    openingCost?: number;
  };
  const name = (body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Item name is required." });
  try {
    const branchId = await resolveBranchId(req);
    const item = await prisma.inventoryItem.create({
      data: {
        name,
        sku: body.sku?.trim() || null,
        category: body.category?.trim() || "General",
        categoryId: body.categoryId || null,
        unit: body.unit || InventoryUnit.KG,
        reorderPoint: body.reorderPoint ?? 0,
        parLevel: body.parLevel ?? null,
        defaultCost: body.defaultCost ?? body.openingCost ?? 0,
        trackStock: body.trackStock ?? true,
        trackExpiry: body.trackExpiry ?? false,
      },
    });
    const open = Number(body.openingStock ?? 0);
    if (open > 0) {
      await applyStockChange({
        branchId,
        itemId: item.id,
        type: StockMovementType.ADJUSTMENT,
        quantityDelta: open,
        unitCost: body.openingCost ?? body.defaultCost ?? 0,
        reason: "Opening stock",
        referenceType: StockReferenceType.ADJUSTMENT,
        actorId: req.user!.id,
        updateAvgCost: true,
      });
    }
    res.status(201).json({ item });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return res.status(409).json({ error: "An item with this name already exists." });
    }
    return handleErr(res, e);
  }
});

inventoryRouter.patch("/items/:id", requireAuth, requireRole(...WRITE_ROLES), async (req, res) => {
  const body = req.body as Partial<{
    name: string;
    sku: string;
    category: string;
    categoryId: string;
    unit: InventoryUnit;
    reorderPoint: number;
    parLevel: number | null;
    defaultCost: number;
    trackStock: boolean;
    trackExpiry: boolean;
    isActive: boolean;
  }>;
  const item = await prisma.inventoryItem.update({
    where: { id: req.params.id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.sku !== undefined ? { sku: body.sku.trim() || null } : {}),
      ...(body.category !== undefined ? { category: body.category.trim() } : {}),
      ...(body.categoryId !== undefined ? { categoryId: body.categoryId || null } : {}),
      ...(body.unit !== undefined ? { unit: body.unit } : {}),
      ...(body.reorderPoint !== undefined ? { reorderPoint: body.reorderPoint } : {}),
      ...(body.parLevel !== undefined ? { parLevel: body.parLevel } : {}),
      ...(body.defaultCost !== undefined ? { defaultCost: body.defaultCost } : {}),
      ...(body.trackStock !== undefined ? { trackStock: body.trackStock } : {}),
      ...(body.trackExpiry !== undefined ? { trackExpiry: body.trackExpiry } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
  });
  res.json({ item });
});

inventoryRouter.post("/adjust", requireAuth, requireRole(...WRITE_ROLES), async (req, res) => {
  try {
    const branchId = await resolveBranchId(req);
    const body = req.body as {
      itemId?: string;
      mode?: "add" | "remove" | "set";
      quantity?: number;
      quantityDelta?: number;
      reason?: string;
      notes?: string;
      wasteReason?: WasteReason;
    };
    if (!body.itemId) return res.status(400).json({ error: "itemId is required." });

    const stock = await prisma.branchStock.findUnique({
      where: { branchId_itemId: { branchId, itemId: body.itemId } },
    });
    const current = Number(stock?.quantity ?? 0);
    let delta = body.quantityDelta != null ? Number(body.quantityDelta) : 0;
    if (body.mode === "add") delta = Number(body.quantity || 0);
    if (body.mode === "remove") delta = -Number(body.quantity || 0);
    if (body.mode === "set") delta = Number(body.quantity ?? 0) - current;
    if (!delta) return res.status(400).json({ error: "Enter a non-zero adjustment." });

    const isWaste =
      body.wasteReason ||
      /wastage|damage|staff meal|spoiled|expired/i.test(body.reason || "");
    const type = isWaste ? StockMovementType.WASTE : StockMovementType.ADJUSTMENT;

    if (isWaste && body.wasteReason) {
      const item = await prisma.inventoryItem.findUnique({ where: { id: body.itemId } });
      const cost = Number(stock?.avgCost ?? item?.defaultCost ?? 0) * Math.abs(delta);
      const log = await prisma.wasteLog.create({
        data: {
          branchId,
          itemId: body.itemId,
          quantity: Math.abs(delta),
          reason: body.wasteReason,
          costAtTime: cost,
          notes: body.notes,
          createdById: req.user!.id,
        },
      });
      await applyStockChange({
        branchId,
        itemId: body.itemId,
        type: StockMovementType.WASTE,
        quantityDelta: delta,
        reason: body.reason,
        notes: body.notes,
        actorId: req.user!.id,
        referenceType: StockReferenceType.WASTE,
        referenceId: log.id,
        wasteLogId: log.id,
      });
    } else {
      await applyStockChange({
        branchId,
        itemId: body.itemId,
        type,
        quantityDelta: delta,
        reason: body.reason,
        notes: body.notes,
        actorId: req.user!.id,
        referenceType: StockReferenceType.ADJUSTMENT,
      });
    }
    res.json({ ok: true, newBalance: roundQty(current + delta) });
  } catch (err) {
    return handleErr(res, err);
  }
});

inventoryRouter.get("/movements", requireAuth, requireRole(...READ_ROLES), async (req, res) => {
  try {
    const branchId = await resolveBranchId(req);
    const itemId = req.query.itemId ? String(req.query.itemId) : undefined;
    const type = req.query.type ? String(req.query.type) as StockMovementType : undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize) || 30);
    const where: Prisma.StockMovementWhereInput = {
      branchId,
      ...(itemId ? { itemId } : {}),
      ...(type ? { type } : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.stockMovement.count({ where }),
      prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { item: { select: { name: true, unit: true } } },
      }),
    ]);
    res.json({
      total,
      page,
      movements: rows.map((m) => ({
        id: m.id,
        type: m.type,
        itemId: m.itemId,
        itemName: m.item.name,
        unit: m.item.unit,
        quantityDelta: Number(m.quantityDelta),
        quantityAfter: Number(m.quantityAfter),
        unitCost: m.unitCost != null ? Number(m.unitCost) : null,
        reason: m.reason,
        reference: m.reference,
        referenceType: m.referenceType,
        referenceId: m.referenceId,
        notes: m.notes,
        actorId: m.actorId,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return branchScopeError(res, err);
  }
});

inventoryRouter.get("/suppliers", requireAuth, requireRole(...READ_ROLES), async (req, res) => {
  const q = String(req.query.q || "").trim();
  const suppliers = await prisma.supplier.findMany({
    where: {
      isActive: req.query.archived === "1" ? undefined : true,
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: { name: "asc" },
  });
  res.json({ suppliers });
});

inventoryRouter.get("/suppliers/:id", requireAuth, requireRole(...READ_ROLES), async (req, res) => {
  const supplier = await prisma.supplier.findUnique({
    where: { id: req.params.id },
    include: {
      supplierItems: { include: { item: { select: { id: true, name: true, unit: true } } } },
      purchases: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!supplier) return res.status(404).json({ error: "Supplier not found." });
  res.json({ supplier });
});

inventoryRouter.post("/suppliers", requireAuth, requireRole(...WRITE_ROLES), async (req, res) => {
  const body = req.body as {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    paymentTerms?: string;
    notes?: string;
  };
  const name = (body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Supplier name is required." });
  const supplier = await prisma.supplier.create({
    data: {
      name,
      phone: body.phone?.trim() || "",
      email: body.email?.trim() || "",
      address: body.address?.trim() || "",
      paymentTerms: body.paymentTerms?.trim() || "",
      notes: body.notes?.trim() || null,
    },
  });
  res.status(201).json({ supplier });
});

inventoryRouter.patch("/suppliers/:id", requireAuth, requireRole(...WRITE_ROLES), async (req, res) => {
  const body = req.body as Partial<{
    name: string;
    phone: string;
    email: string;
    address: string;
    paymentTerms: string;
    notes: string;
    isActive: boolean;
  }>;
  const supplier = await prisma.supplier.update({
    where: { id: req.params.id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.phone !== undefined ? { phone: body.phone.trim() } : {}),
      ...(body.email !== undefined ? { email: body.email.trim() } : {}),
      ...(body.address !== undefined ? { address: body.address.trim() } : {}),
      ...(body.paymentTerms !== undefined ? { paymentTerms: body.paymentTerms.trim() } : {}),
      ...(body.notes !== undefined ? { notes: body.notes.trim() || null } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
  });
  res.json({ supplier });
});

inventoryRouter.get("/purchases", requireAuth, requireRole(...READ_ROLES), async (req, res) => {
  try {
    const branchId = await resolveBranchId(req);
    const purchases = await prisma.inventoryPurchase.findMany({
      where: { branchId, status: { not: PurchaseStatus.DRAFT } },
      orderBy: { purchaseDate: "desc" },
      take: 50,
      include: {
        supplier: { select: { name: true } },
        lines: { select: { id: true } },
      },
    });
    res.json({
      purchases: purchases.map((p) => ({
        id: p.id,
        supplierName: p.supplier?.name ?? "—",
        invoiceRef: p.invoiceRef,
        purchaseDate: p.purchaseDate.toISOString(),
        total: Number(p.total),
        paidAmount: Number(p.paidAmount),
        paymentStatus: p.paymentStatus,
        status: p.status,
        lineCount: p.lines.length,
      })),
    });
  } catch (err) {
    return branchScopeError(res, err);
  }
});

inventoryRouter.post("/receive", requireAuth, requireRole(...WRITE_ROLES), async (req, res) => {
  try {
    const branchId = await resolveBranchId(req);
    const body = req.body as {
      supplierId?: string;
      invoiceRef?: string;
      notes?: string;
      purchaseDate?: string;
      taxAmount?: number;
      discount?: number;
      paidAmount?: number;
      lines?: {
        itemId: string;
        quantity: number;
        unitCost?: number;
        expiryDate?: string;
        batchNo?: string;
      }[];
    };
    const lines = body.lines || [];
    if (!lines.length) return res.status(400).json({ error: "Add at least one line." });

    const warnings: string[] = [];
    let subtotal = 0;
    type PrepLine = {
      itemId: string;
      qty: number;
      unitCost: number;
      expiryDate?: string;
      batchNo?: string;
    };
    const prepared: PrepLine[] = [];
    for (const line of lines) {
      const qty = Number(line.quantity);
      if (!line.itemId || qty <= 0) continue;
      const unitCost = Number(line.unitCost ?? 0);
      subtotal += qty * unitCost;
      prepared.push({
        itemId: line.itemId,
        qty,
        unitCost,
        expiryDate: line.expiryDate,
        batchNo: line.batchNo,
      });
    }
    if (!prepared.length) return res.status(400).json({ error: "Add at least one valid line." });

    const tax = Number(body.taxAmount ?? 0);
    const discount = Number(body.discount ?? 0);
    const total = subtotal + tax - discount;
    const paid = Number(body.paidAmount ?? total);
    let paymentStatus: PurchasePaymentStatus = PurchasePaymentStatus.UNPAID;
    if (paid >= total) paymentStatus = PurchasePaymentStatus.PAID;
    else if (paid > 0) paymentStatus = PurchasePaymentStatus.PARTIAL;

    const purchase = await prisma.inventoryPurchase.create({
      data: {
        branchId,
        supplierId: body.supplierId || null,
        invoiceRef: body.invoiceRef?.trim() || null,
        notes: body.notes?.trim() || null,
        purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : new Date(),
        subtotal,
        taxAmount: tax,
        discount,
        total,
        paidAmount: paid,
        paymentStatus,
        status: PurchaseStatus.RECEIVED,
        createdById: req.user!.id,
      },
    });

    for (const line of prepared) {
      const item = await prisma.inventoryItem.findUnique({ where: { id: line.itemId } });
      if (!item) continue;
      const stock = await prisma.branchStock.findUnique({
        where: { branchId_itemId: { branchId, itemId: line.itemId } },
      });
      const oldAvg = Number(stock?.avgCost ?? item.defaultCost);
      if (oldAvg > 0 && Math.abs(line.unitCost - oldAvg) / oldAvg > 0.2) {
        warnings.push(`${item.name}: cost ${line.unitCost} differs >20% from avg ${oldAvg.toFixed(2)}`);
      }

      const pl = await prisma.inventoryPurchaseLine.create({
        data: {
          purchaseId: purchase.id,
          itemId: line.itemId,
          quantity: line.qty,
          unitCost: line.unitCost,
          lineTotal: line.qty * line.unitCost,
          batchNo: line.batchNo?.trim() || null,
          expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
        },
      });

      await applyStockChange({
        branchId,
        itemId: line.itemId,
        type: StockMovementType.PURCHASE,
        quantityDelta: line.qty,
        unitCost: line.unitCost,
        reference: body.invoiceRef || purchase.id,
        referenceType: StockReferenceType.PURCHASE,
        referenceId: purchase.id,
        notes: body.notes,
        actorId: req.user!.id,
        purchaseLineId: pl.id,
        updateAvgCost: true,
        batchExpiry: item.trackExpiry ? (line.expiryDate ? new Date(line.expiryDate) : null) : null,
        purchaseLineIdForBatch: pl.id,
      });

      if (body.supplierId) {
        await prisma.supplierItem.upsert({
          where: { supplierId_itemId: { supplierId: body.supplierId, itemId: line.itemId } },
          create: { supplierId: body.supplierId, itemId: line.itemId, lastPrice: line.unitCost },
          update: { lastPrice: line.unitCost },
        });
      }
    }

    res.status(201).json({ purchaseId: purchase.id, warnings });
  } catch (err) {
    return handleErr(res, err);
  }
});

inventoryRouter.post("/purchases/:id/void", requireAuth, requireRole(...WRITE_ROLES), async (req, res) => {
  try {
    const branchId = await resolveBranchId(req);
    const body = req.body as { managerOverride?: boolean; reason?: string };
    const purchase = await prisma.inventoryPurchase.findFirst({
      where: { id: req.params.id, branchId },
      include: { lines: true },
    });
    if (!purchase) return res.status(404).json({ error: "Purchase not found." });
    if (purchase.status === PurchaseStatus.VOIDED) {
      return res.status(400).json({ error: "Purchase is already voided." });
    }

    const { writeAudit } = await import("../../lib/audit");
    const { AuditAction } = await import("../../lib/audit-actions");

    await prisma.$transaction(async (tx) => {
      for (const line of purchase.lines) {
        const qty = Number(line.quantity);
        try {
          await applyStockChange({
            branchId,
            itemId: line.itemId,
            type: StockMovementType.ADJUSTMENT,
            quantityDelta: -qty,
            unitCost: Number(line.unitCost),
            reason: body.reason?.trim() || `Void purchase ${purchase.invoiceRef || purchase.id}`,
            referenceType: StockReferenceType.PURCHASE,
            referenceId: purchase.id,
            actorId: req.user!.id,
            allowNegative: Boolean(body.managerOverride),
          });
        } catch (err) {
          const code = (err as { code?: string }).code;
          if (code === "INSUFFICIENT_STOCK" && !body.managerOverride) {
            throw Object.assign(new Error("Void would make stock negative. Manager override required."), {
              status: 409,
              code: "NEGATIVE_STOCK",
            });
          }
          throw err;
        }
      }
      await tx.inventoryPurchase.update({
        where: { id: purchase.id },
        data: { status: PurchaseStatus.VOIDED, voidedAt: new Date() },
      });
    });

    await writeAudit(prisma, {
      action: AuditAction.PURCHASE_VOIDED,
      actorId: req.user!.id,
      branchId,
      entityType: "inventory_purchase",
      entityId: purchase.id,
      reason: body.reason?.trim() || null,
    });

    res.json({ ok: true });
  } catch (err) {
    return handleErr(res, err);
  }
});

inventoryRouter.get("/movements/export.csv", requireAuth, requireRole(...READ_ROLES), async (req, res) => {
  try {
    const branchId = await resolveBranchId(req);
    const rows = await prisma.stockMovement.findMany({
      where: { branchId },
      orderBy: { createdAt: "desc" },
      take: 5000,
      include: { item: { select: { name: true, unit: true } } },
    });
    const header = "date,type,item,quantityDelta,quantityAfter,reason,reference\n";
    const body = rows
      .map((m) =>
        [
          m.createdAt.toISOString(),
          m.type,
          `"${m.item.name.replace(/"/g, '""')}"`,
          Number(m.quantityDelta),
          Number(m.quantityAfter),
          `"${(m.reason || "").replace(/"/g, '""')}"`,
          m.reference || "",
        ].join(",")
      )
      .join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="stock-movements.csv"');
    res.send(header + body);
  } catch (err) {
    return branchScopeError(res, err);
  }
});

inventoryRouter.post("/purchases/:id/payment", requireAuth, requireRole(...WRITE_ROLES), async (req, res) => {
  const amount = Number((req.body as { amount?: number }).amount ?? 0);
  const purchase = await prisma.inventoryPurchase.findUnique({ where: { id: req.params.id } });
  if (!purchase) return res.status(404).json({ error: "Purchase not found." });
  const paid = Number(purchase.paidAmount) + amount;
  const total = Number(purchase.total);
  let paymentStatus: PurchasePaymentStatus = PurchasePaymentStatus.PARTIAL;
  if (paid >= total) paymentStatus = PurchasePaymentStatus.PAID;
  else if (paid <= 0) paymentStatus = PurchasePaymentStatus.UNPAID;
  const updated = await prisma.inventoryPurchase.update({
    where: { id: purchase.id },
    data: { paidAmount: paid, paymentStatus },
  });
  res.json({ purchase: updated });
});

inventoryRouter.post("/waste", requireAuth, requireRole(...WRITE_ROLES), async (req, res) => {
  try {
    const branchId = await resolveBranchId(req);
    const body = req.body as {
      itemId?: string;
      menuItemId?: string;
      quantity?: number;
      reason?: WasteReason;
      notes?: string;
      loggedAt?: string;
    };
    const qty = Number(body.quantity ?? 0);
    if (!body.itemId || qty <= 0 || !body.reason) {
      return res.status(400).json({ error: "itemId, quantity, and reason are required." });
    }
    const stock = await prisma.branchStock.findUnique({
      where: { branchId_itemId: { branchId, itemId: body.itemId } },
    });
    const cost = Number(stock?.avgCost ?? 0) * qty;
    const log = await prisma.wasteLog.create({
      data: {
        branchId,
        itemId: body.itemId,
        menuItemId: body.menuItemId || null,
        quantity: qty,
        reason: body.reason,
        costAtTime: cost,
        notes: body.notes,
        loggedAt: body.loggedAt ? new Date(body.loggedAt) : new Date(),
        createdById: req.user!.id,
      },
    });
    await applyStockChange({
      branchId,
      itemId: body.itemId,
      type: StockMovementType.WASTE,
      quantityDelta: -qty,
      reason: body.reason,
      notes: body.notes,
      actorId: req.user!.id,
      referenceType: StockReferenceType.WASTE,
      referenceId: log.id,
      wasteLogId: log.id,
    });
    res.status(201).json({ waste: log });
  } catch (err) {
    return handleErr(res, err);
  }
});

inventoryRouter.get("/waste", requireAuth, requireRole(...READ_ROLES), async (req, res) => {
  try {
    const branchId = await resolveBranchId(req);
    const logs = await prisma.wasteLog.findMany({
      where: { branchId },
      orderBy: { loggedAt: "desc" },
      take: 100,
      include: { item: { select: { name: true, unit: true } } },
    });
    const now = new Date();
    const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startWeek = new Date(startDay);
    startWeek.setDate(startWeek.getDate() - 7);
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sum = (from: Date) =>
      logs.filter((l) => l.loggedAt >= from).reduce((s, l) => s + Number(l.costAtTime), 0);
    const byReason = logs.reduce<Record<string, number>>((acc, l) => {
      acc[l.reason] = (acc[l.reason] || 0) + Number(l.costAtTime);
      return acc;
    }, {});
    res.json({
      logs: logs.map((l) => ({
        id: l.id,
        itemName: l.item?.name ?? "—",
        quantity: Number(l.quantity),
        reason: l.reason,
        costAtTime: Number(l.costAtTime),
        notes: l.notes,
        loggedAt: l.loggedAt.toISOString(),
      })),
      totals: { today: sum(startDay), week: sum(startWeek), month: sum(startMonth) },
      byReason,
    });
  } catch (err) {
    return branchScopeError(res, err);
  }
});

inventoryRouter.get("/recipes/:menuItemId", requireAuth, requireRole(...WRITE_ROLES), async (req, res) => {
  try {
    const branchId = await resolveBranchId(req);
    const menuItemId = req.params.menuItemId;
    const [lines, meta, menu] = await Promise.all([
      prisma.recipeLine.findMany({
        where: { menuItemId },
        include: { item: { select: { id: true, name: true, unit: true, defaultCost: true } } },
      }),
      prisma.menuRecipe.findUnique({ where: { menuItemId } }),
      prisma.menuItem.findUnique({
        where: { id: menuItemId },
        select: { price: true, discountPrice: true, name: true },
      }),
    ]);
    if (!menu) return res.status(404).json({ error: "Menu item not found." });
    const { buildDishEconomics } = await import("../../lib/costing/compute");
    const { loadCostingContext } = await import("../../lib/costing/report");
    const { settings, costByIngredient } = await loadCostingContext(branchId);
    const yieldPortions = Math.max(1, meta?.yieldPortions ?? 1);
    const econ = buildDishEconomics(menu, lines, costByIngredient, yieldPortions, settings, null);
    const costWarning =
      econ.status === "NO_RECIPE"
        ? "This dish has no recipe yet."
        : econ.status === "INCOMPLETE"
          ? `Missing ingredient costs: ${econ.missingIngredients.join(", ")}`
          : econ.status === "SUSPICIOUS_LOW"
            ? "Recipe cost looks unusually low — check quantities and costs."
            : null;
    res.json({
      yieldPortions,
      notes: meta?.notes ?? "",
      recipeCost: econ.recipeCostDisplay ?? 0,
      price: econ.price,
      netPrice: econ.netPrice,
      marginPercent: econ.marginPercent ?? 0,
      foodCostPercent: econ.foodCostPercent ?? 0,
      costStatus: econ.status,
      missingIngredients: econ.missingIngredients,
      costWarning,
      lines: lines.map((l) => ({
        id: l.id,
        itemId: l.itemId,
        itemName: l.item.name,
        unit: l.item.unit,
        quantity: Number(l.quantity),
      })),
    });
  } catch (err) {
    return branchScopeError(res, err);
  }
});

inventoryRouter.put("/recipes/:menuItemId", requireAuth, requireRole(...WRITE_ROLES), async (req, res) => {
  const body = req.body as {
    lines?: { itemId: string; quantity: number }[];
    yieldPortions?: number;
    notes?: string;
  };
  const menuItemId = req.params.menuItemId;
  const menu = await prisma.menuItem.findUnique({ where: { id: menuItemId } });
  if (!menu) return res.status(404).json({ error: "Menu item not found." });

  await prisma.recipeLine.deleteMany({ where: { menuItemId } });
  const lines = (body.lines || []).filter((l) => l.itemId && l.quantity > 0);
  if (lines.length) {
    await prisma.recipeLine.createMany({
      data: lines.map((l) => ({ menuItemId, itemId: l.itemId, quantity: l.quantity })),
    });
  }
  await prisma.menuRecipe.upsert({
    where: { menuItemId },
    create: { menuItemId, yieldPortions: body.yieldPortions ?? 1, notes: body.notes },
    update: { yieldPortions: body.yieldPortions ?? 1, notes: body.notes },
  });
  res.json({ ok: true });
});

inventoryRouter.get("/menu-items", requireAuth, requireRole(...WRITE_ROLES), async (_req, res) => {
  const items = await prisma.menuItem.findMany({
    select: { id: true, name: true, category: true, price: true },
    orderBy: { name: "asc" },
  });
  const recipes = await prisma.recipeLine.groupBy({ by: ["menuItemId"] });
  const has = new Set(recipes.map((r) => r.menuItemId));
  res.json({
    items: items.map((i) => ({
      ...i,
      price: Number(i.price),
      hasRecipe: has.has(i.id),
    })),
  });
});

inventoryRouter.get("/counts", requireAuth, requireRole(...READ_ROLES), async (req, res) => {
  try {
    const branchId = await resolveBranchId(req);
    const counts = await prisma.stockCount.findMany({
      where: { branchId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    res.json({ counts });
  } catch (err) {
    return branchScopeError(res, err);
  }
});

inventoryRouter.get("/counts/:id", requireAuth, requireRole(...READ_ROLES), async (req, res) => {
  const count = await prisma.stockCount.findUnique({
    where: { id: req.params.id },
    include: {
      lines: { include: { item: { select: { name: true, unit: true, defaultCost: true } } } },
    },
  });
  if (!count) return res.status(404).json({ error: "Count not found." });
  res.json({
    count: {
      ...count,
      lines: count.lines.map((l) => ({
        id: l.id,
        itemId: l.itemId,
        itemName: l.item.name,
        unit: l.item.unit,
        systemQty: Number(l.systemQty),
        countedQty: l.countedQty != null ? Number(l.countedQty) : null,
        variance: l.variance != null ? Number(l.variance) : null,
        varianceCost: l.varianceCost != null ? Number(l.varianceCost) : null,
      })),
    },
  });
});

inventoryRouter.post("/counts", requireAuth, requireRole(...WRITE_ROLES), async (req, res) => {
  try {
    const branchId = await resolveBranchId(req);
    const items = await prisma.inventoryItem.findMany({ where: { isActive: true, trackStock: true } });
    const stocks = await prisma.branchStock.findMany({ where: { branchId } });
    const qtyMap = new Map(stocks.map((s) => [s.itemId, Number(s.quantity)]));
    const count = await prisma.stockCount.create({
      data: {
        branchId,
        countedById: req.user!.id,
        lines: {
          create: items.map((i) => ({
            itemId: i.id,
            systemQty: qtyMap.get(i.id) ?? 0,
          })),
        },
      },
      include: { lines: { include: { item: { select: { name: true, unit: true } } } } },
    });
    res.status(201).json({ count });
  } catch (err) {
    return branchScopeError(res, err);
  }
});

inventoryRouter.patch("/counts/:id/lines", requireAuth, requireRole(...WRITE_ROLES), async (req, res) => {
  const body = req.body as { lines?: { itemId: string; countedQty: number }[] };
  const count = await prisma.stockCount.findUnique({ where: { id: req.params.id } });
  if (!count || count.status !== StockCountStatus.DRAFT) {
    return res.status(400).json({ error: "Count is not editable." });
  }
  for (const line of body.lines || []) {
    const row = await prisma.stockCountLine.findUnique({
      where: { countId_itemId: { countId: count.id, itemId: line.itemId } },
      include: { item: { select: { defaultCost: true } } },
    });
    if (!row) continue;
    const variance = roundQty(line.countedQty - Number(row.systemQty));
    const stock = await prisma.branchStock.findUnique({
      where: { branchId_itemId: { branchId: count.branchId, itemId: line.itemId } },
    });
    const cost = Number(stock?.avgCost ?? row.item?.defaultCost ?? 0);
    await prisma.stockCountLine.update({
      where: { id: row.id },
      data: {
        countedQty: line.countedQty,
        variance,
        varianceCost: variance * cost,
      },
    });
  }
  res.json({ ok: true });
});

inventoryRouter.post("/counts/:id/submit", requireAuth, requireRole(...WRITE_ROLES), async (req, res) => {
  const count = await prisma.stockCount.update({
    where: { id: req.params.id },
    data: { status: StockCountStatus.SUBMITTED, submittedAt: new Date() },
  });
  res.json({ count });
});

inventoryRouter.post("/counts/:id/approve", requireAuth, requireRole(...WRITE_ROLES), async (req, res) => {
  const count = await prisma.stockCount.findUnique({
    where: { id: req.params.id },
    include: { lines: true },
  });
  if (!count || count.status !== StockCountStatus.SUBMITTED) {
    return res.status(400).json({ error: "Count must be submitted before approval." });
  }
  for (const line of count.lines) {
    if (line.variance == null || Number(line.variance) === 0) continue;
    await applyStockChange({
      branchId: count.branchId,
      itemId: line.itemId,
      type: StockMovementType.COUNT_CORRECTION,
      quantityDelta: Number(line.variance),
      reason: "Stock count approval",
      referenceType: StockReferenceType.COUNT,
      referenceId: count.id,
      actorId: req.user!.id,
    });
  }
  const updated = await prisma.stockCount.update({
    where: { id: count.id },
    data: {
      status: StockCountStatus.APPROVED,
      approvedAt: new Date(),
      approvedById: req.user!.id,
    },
  });
  res.json({ count: updated });
});

inventoryRouter.get("/transfers", requireAuth, requireRole(...READ_ROLES), async (req, res) => {
  try {
    const branchId = await resolveBranchId(req);
    const transfers = await prisma.stockTransfer.findMany({
      where: { OR: [{ fromBranchId: branchId }, { toBranchId: branchId }] },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { lines: { include: { item: { select: { name: true } } } } },
    });
    res.json({ transfers });
  } catch (err) {
    return branchScopeError(res, err);
  }
});

inventoryRouter.post("/transfers", requireAuth, requireRole(...WRITE_ROLES), async (req, res) => {
  try {
    const fromBranchId = await resolveBranchId(req);
    const body = req.body as { toBranchId?: string; lines?: { itemId: string; quantity: number }[] };
    if (!body.toBranchId || fromBranchId === body.toBranchId) {
      return res.status(400).json({ error: "Choose a different destination branch." });
    }
    const transfer = await prisma.stockTransfer.create({
      data: {
        fromBranchId,
        toBranchId: body.toBranchId,
        createdById: req.user!.id,
        lines: {
          create: (body.lines || [])
            .filter((l) => l.itemId && l.quantity > 0)
            .map((l) => ({ itemId: l.itemId, quantitySent: l.quantity })),
        },
      },
    });
    res.status(201).json({ transfer });
  } catch (err) {
    return handleErr(res, err);
  }
});

inventoryRouter.post("/transfers/:id/ship", requireAuth, requireRole(...WRITE_ROLES), async (req, res) => {
  const transfer = await prisma.stockTransfer.findUnique({
    where: { id: req.params.id },
    include: { lines: true },
  });
  if (!transfer || transfer.status !== TransferStatus.PENDING) {
    return res.status(400).json({ error: "Transfer cannot be shipped." });
  }
  for (const line of transfer.lines) {
    await applyStockChange({
      branchId: transfer.fromBranchId,
      itemId: line.itemId,
      type: StockMovementType.TRANSFER_OUT,
      quantityDelta: -Number(line.quantitySent),
      referenceType: StockReferenceType.TRANSFER,
      referenceId: transfer.id,
      actorId: req.user!.id,
    });
  }
  const updated = await prisma.stockTransfer.update({
    where: { id: transfer.id },
    data: { status: TransferStatus.IN_TRANSIT, shippedAt: new Date() },
  });
  res.json({ transfer: updated });
});

inventoryRouter.post("/transfers/:id/receive", requireAuth, requireRole(...WRITE_ROLES), async (req, res) => {
  const body = req.body as { lines?: { itemId: string; quantityReceived: number }[] };
  const transfer = await prisma.stockTransfer.findUnique({
    where: { id: req.params.id },
    include: { lines: true },
  });
  if (!transfer || transfer.status !== TransferStatus.IN_TRANSIT) {
    return res.status(400).json({ error: "Transfer is not in transit." });
  }
  const recvMap = new Map((body.lines || []).map((l) => [l.itemId, l.quantityReceived]));
  for (const line of transfer.lines) {
    const qty = recvMap.get(line.itemId) ?? Number(line.quantitySent);
    await prisma.stockTransferLine.update({
      where: { id: line.id },
      data: { quantityReceived: qty },
    });
    await applyStockChange({
      branchId: transfer.toBranchId,
      itemId: line.itemId,
      type: StockMovementType.TRANSFER_IN,
      quantityDelta: qty,
      referenceType: StockReferenceType.TRANSFER,
      referenceId: transfer.id,
      actorId: req.user!.id,
    });
  }
  const updated = await prisma.stockTransfer.update({
    where: { id: transfer.id },
    data: { status: TransferStatus.RECEIVED, receivedAt: new Date(), receivedById: req.user!.id },
  });
  res.json({ transfer: updated });
});

inventoryRouter.get("/alerts", requireAuth, requireRole(...READ_ROLES), async (req, res) => {
  try {
    const branchId = await resolveBranchId(req);
    const [lowStock, expiring] = await Promise.all([
      lowStockForBranch(branchId),
      expiringBatches(branchId, 7),
    ]);
    res.json({
      lowStockCount: lowStock.length,
      lowStock: lowStock.slice(0, 5),
      expiring,
    });
  } catch (err) {
    return branchScopeError(res, err);
  }
});

inventoryRouter.get("/reorder-suggestions", requireAuth, requireRole(...READ_ROLES), async (req, res) => {
  try {
    const branchId = await resolveBranchId(req);
    const stocks = await prisma.branchStock.findMany({
      where: { branchId },
      include: { item: { include: { supplierItems: { include: { supplier: true } } } } },
    });
    const suggestions = stocks
      .filter((s) => s.item.isActive && Number(s.quantity) <= Number(s.item.reorderPoint))
      .map((s) => {
        const onHand = Number(s.quantity);
        const par = s.item.parLevel != null ? Number(s.item.parLevel) : Number(s.item.reorderPoint) * 2;
        const suggested = Math.max(0, par - onHand);
        const supplier = s.item.supplierItems[0]?.supplier;
        return {
          itemId: s.itemId,
          name: s.item.name,
          onHand,
          suggestedQty: suggested,
          supplierId: supplier?.id,
          supplierName: supplier?.name,
        };
      });
    res.json({ suggestions });
  } catch (err) {
    return branchScopeError(res, err);
  }
});

inventoryRouter.get("/reports/valuation", requireAuth, requireRole(...READ_ROLES), async (req, res) => {
  try {
    const branchId = await resolveBranchId(req);
    const stocks = await prisma.branchStock.findMany({
      where: { branchId },
      include: { item: true },
    });
    const byCategory: Record<string, number> = {};
    for (const s of stocks) {
      const cat = s.item.category;
      const val = Number(s.quantity) * Number(s.avgCost || s.item.defaultCost);
      byCategory[cat] = (byCategory[cat] || 0) + val;
    }
    res.json({ byCategory });
  } catch (err) {
    return branchScopeError(res, err);
  }
});
