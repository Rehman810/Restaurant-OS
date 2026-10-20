import { Router } from "express";
import {
  CashMovementType,
  CashShiftStatus,
  FulfillmentType,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  Role,
} from "@prisma/client";
import { prisma } from "../lib/prisma";
import { findOrderBlock } from "../lib/blocklist";
import { buildOrderLines } from "../lib/order-lines";
import { nextPosOrderNumber } from "../lib/pos-order-number";
import { emitOrderChange } from "../lib/realtime";
import { storeNameFrom } from "../lib/branding";
import { applyOrderDiscount, quoteCharges } from "../lib/charges";
import { enrichLinesWithTax } from "../lib/tax/apply";
import { issueCreditNoteForOrder, issueTaxInvoiceForOrder } from "../lib/tax/invoicing";
import {
  discountNeedsManagerApproval,
  parseReasonList,
  resolveSensitiveApproval,
  validateReasonCode,
} from "../lib/order-approval";
import { writeAudit } from "../lib/audit";
import { AuditAction } from "../lib/audit-actions";
import { clientIp } from "../lib/client-ip";
import { cleanText } from "../lib/text";
import { getStoreSettings } from "../lib/settings-data";
import { branchScopeError, getDefaultBranchId, resolveBranchScope } from "../lib/branch-scope";
import { ADMIN_LIKE } from "../lib/roles";
import { requireAuth, requireRole } from "../middleware/auth";
import { posLimiter } from "../middleware/security";
import {
  recordCashMovement,
  SHIFT_REQUIRED_CODE,
  SHIFT_REQUIRED_ERROR,
  type CashDb,
} from "../lib/cash-shift";
import { posShiftRouter } from "./pos-shift";
import {
  syncPosCashMovementFromOffline,
  syncPosOrderFromOffline,
  validateOfflineSyncPayload,
  type PosCashMovementSyncInput,
  type PosSyncInput,
} from "../lib/pos-offline-sync";
import {
  clientTotalMatchesServer,
  computePosTotals,
  resolveTaxContextForPayments,
} from "../lib/pos-totals";
import { normalizePosPayments, validatePosPayments, type PosPaymentInput } from "../lib/pos-payments";
import { resolvePosDineIn } from "../lib/pos-dine-in";
import {
  createPosHold,
  getPosHoldForBranch,
  listPosHolds,
  DEFAULT_POS_HOLD_HOURS,
} from "../lib/pos-holds";
import { listRecentPosOrders } from "../lib/pos-recent";
import { posPopularMenuItemIds } from "../lib/pos-popular";

export const posRouter = Router();
posRouter.use("/shift", posShiftRouter);

async function recordRefundCash(
  db: CashDb,
  branchId: string,
  cashierId: string,
  orderId: string,
  amount: number,
  reason: string,
  createdById: string
) {
  const shift = await db.cashShift.findFirst({
    where: { branchId, cashierId, status: CashShiftStatus.OPEN },
  });
  if (!shift) {
    throw Object.assign(new Error(SHIFT_REQUIRED_ERROR), { status: 403, code: SHIFT_REQUIRED_CODE });
  }
  await recordCashMovement(db, {
    shiftId: shift.id,
    type: CashMovementType.REFUND_CASH,
    amount,
    reason,
    orderId,
    createdById,
  });
}

const include = {
  items: true,
  payments: { orderBy: { sortOrder: "asc" as const } },
  deliveryArea: { select: { id: true, name: true, deliveryCharge: true } },
  createdBy: { select: { id: true, name: true } },
};

function normalizePhone(phone: string) {
  const cleaned = phone.replace(/[^\d+]/g, "").trim();
  return cleaned.length >= 10 ? cleaned : "";
}

posRouter.post("/", posLimiter, requireAuth, requireRole(...ADMIN_LIKE, Role.CASHIER, Role.WAITER), async (req, res) => {
  const storeSettings = await getStoreSettings();
  const storeAddress = `${storeNameFrom(storeSettings)} — ${storeSettings.address}`;

  const {
    items,
    deals,
    fulfillmentType,
    deliveryAreaId,
    deliveryAddress,
    customerName,
    customerPhone,
    notes,
    tableNumber,
    tableSessionId,
    diningTableId,
    waiterId,
    paymentMethod,
    paymentStatus,
    payments,
    cashTendered,
    cashChangeGiven,
    clientTotal,
    idempotencyKey,
    discountPercent,
    discountReasonCode,
    discountReasonNote,
    approval,
  } = req.body as {
    items?: {
      menuItemId: string;
      quantity: number;
      sizeId?: string;
      optionIds?: string[];
      addonIds?: string[];
      instructions?: string;
      unitPriceOverride?: number;
    }[];
    deals?: { dealId: string; quantity: number }[];
    fulfillmentType?: FulfillmentType;
    deliveryAreaId?: string;
    deliveryAddress?: string;
    customerName?: string;
    customerPhone?: string;
    notes?: string;
    tableNumber?: string;
    tableSessionId?: string;
    diningTableId?: string;
    waiterId?: string;
    paymentMethod?: PaymentMethod;
    paymentStatus?: "PAID" | "UNPAID";
    payments?: PosPaymentInput[];
    cashTendered?: number;
    cashChangeGiven?: number;
    clientTotal?: number;
    idempotencyKey?: string;
    discountPercent?: number;
    discountReasonCode?: string;
    discountReasonNote?: string;
    approval?: { approverId?: string; pin?: string };
  };

  const mode =
    fulfillmentType === FulfillmentType.DINE_IN
      ? FulfillmentType.DINE_IN
      : fulfillmentType === FulfillmentType.PICKUP
        ? FulfillmentType.PICKUP
        : FulfillmentType.DELIVERY;

  const idemKey = String(idempotencyKey || "").trim();
  if (idemKey) {
    const existing = await prisma.order.findUnique({
      where: { posClientOrderId: idemKey },
      include,
    });
    if (existing) return res.status(200).json(existing);
  }

  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }
  const resolvedBranchId = scope.allBranches ? await getDefaultBranchId() : scope.branchId!;

  const built = await buildOrderLines(items ?? [], deals ?? [], { branchId: resolvedBranchId });
  if (!built.ok) return res.status(built.status).json({ error: built.error });

  if (built.hadPriceOverride) {
    const resolved = await resolveSensitiveApproval(
      "PRICE_OVERRIDE",
      { id: req.user!.id, role: req.user!.role },
      storeSettings,
      approval,
      { ip: clientIp(req) ?? undefined }
    );
    if (!resolved.ok) {
      return res.status(resolved.status).json({ error: resolved.error, code: resolved.code });
    }
  }

  let deliveryCharge = 0;
  let areaId: string | null = null;
  let address = storeAddress;
  let resolvedTableNumber: string | null = null;
  let resolvedDiningTableId: string | null = diningTableId || null;
  let resolvedSessionId: string | null = tableSessionId || null;
  let resolvedWaiterId: string | null = waiterId || null;

  if (mode === FulfillmentType.DELIVERY) {
    if (!deliveryAreaId) {
      return res.status(400).json({ error: "Select a delivery area for delivery orders." });
    }
    const area = await prisma.deliveryArea.findUnique({ where: { id: deliveryAreaId } });
    if (!area || !area.isDelivering) {
      return res.status(400).json({ error: "Selected area is not available." });
    }
    deliveryCharge = Number(area.deliveryCharge);
    areaId = area.id;
    const addr = String(deliveryAddress || "").trim();
    if (!addr) {
      return res.status(400).json({ error: "Delivery address is required." });
    }
    address = addr;
    const nameCheck = cleanText(customerName, 80);
    const phoneCheck = normalizePhone(String(customerPhone || ""));
    if (!nameCheck) {
      return res.status(400).json({ error: "Customer name is required for delivery." });
    }
    if (!phoneCheck) {
      return res.status(400).json({ error: "Customer phone is required for delivery." });
    }
    if (
      storeSettings.freeDeliveryAbove != null &&
      built.subtotal >= Number(storeSettings.freeDeliveryAbove)
    ) {
      deliveryCharge = 0;
    }
  } else if (mode === FulfillmentType.DINE_IN) {
    const dine = await resolvePosDineIn(resolvedBranchId, {
      tableNumber,
      tableSessionId,
      diningTableId,
      waiterId,
    });
    if (!dine.ok) return res.status(dine.status).json({ error: dine.error });
    resolvedTableNumber = dine.resolvedTableNumber;
    resolvedDiningTableId = dine.resolvedDiningTableId;
    resolvedSessionId = dine.resolvedSessionId;
    resolvedWaiterId = dine.resolvedWaiterId;
    address = dine.resolvedTableNumber
      ? `Dine-in · Table ${dine.resolvedTableNumber}`
      : "Dine-in · Counter";
  } else {
    address = storeAddress;
  }

  const pct = Number(discountPercent ?? 0);
  const maxCashierPct = Number(storeSettings.maxCashierDiscountPercent ?? 10);
  const needsDiscountApproval = discountNeedsManagerApproval(req.user!.role, pct, storeSettings);
  if (pct > 0) {
    const reasons = parseReasonList(storeSettings.discountReasonOptions);
    const code = String(discountReasonCode || "").trim();
    if (!validateReasonCode(code, reasons)) {
      return res.status(400).json({ error: "Select a discount reason." });
    }
  }

  const lineInputs = built.lines.map((l) => ({ price: l.priceAtOrder, quantity: l.quantity }));
  const provisionalPay =
    paymentMethod === PaymentMethod.CARD ? PaymentMethod.CARD : PaymentMethod.CASH;
  const provisionalTaxCtx = { fulfillmentType: mode, paymentMethod: provisionalPay };
  const totals = computePosTotals({
    lines: lineInputs,
    deliveryCharge,
    discountPercent: pct > 0 ? pct : null,
    settings: storeSettings,
    taxCtx: provisionalTaxCtx,
  });
  const totalMatch = clientTotalMatchesServer(clientTotal, totals.totalMinor);
  if (!totalMatch.ok) return res.status(400).json({ error: totalMatch.error });

  const payStatus = paymentStatus === "UNPAID" ? "UNPAID" : "PAID";
  const fallbackMethod =
    paymentMethod === PaymentMethod.CARD ? PaymentMethod.CARD : PaymentMethod.CASH;
  const paymentRows = normalizePosPayments(payments, {
    method: fallbackMethod,
    total: totals.total,
    tendered: cashTendered,
    changeGiven: cashChangeGiven,
  });
  const payValidation =
    payStatus === "PAID"
      ? validatePosPayments(paymentRows, totals.totalMinor)
      : { ok: true as const, cashDrawerMinor: 0, primaryMethod: fallbackMethod, normalized: paymentRows };
  if (!payValidation.ok) return res.status(400).json({ error: payValidation.error });

  const payMethod = payValidation.primaryMethod;
  const taxCtx = resolveTaxContextForPayments(payValidation.normalized, mode);
  const enriched = enrichLinesWithTax(built.lines, storeSettings, taxCtx);
  const quoted = quoteCharges(built.subtotal, deliveryCharge, storeSettings, taxCtx);
  const discounted = applyOrderDiscount(quoted, pct > 0 ? pct : null, null);
  if (Math.abs(totals.total - discounted.total) > 0.02) {
    return res.status(400).json({ error: "Total mismatch after tax recalculation." });
  }

  if (payMethod === PaymentMethod.CARD && !storeSettings.acceptCard) {
    return res.status(400).json({ error: "Card at the counter is turned off." });
  }
  if (
    payValidation.normalized.some((p) => p.method === PaymentMethod.CASH) &&
    !storeSettings.acceptCash
  ) {
    return res.status(400).json({ error: "Cash is turned off." });
  }

  const name = cleanText(customerName, 80) || "Walk-in";
  const phone = normalizePhone(String(customerPhone || ""));

  const blocked = await findOrderBlock(null, phone || "");
  if (blocked) {
    return res.status(403).json({
      error: "This contact is blocked from ordering. Contact a manager.",
    });
  }

  let discountApproverId: string | null = null;
  if (needsDiscountApproval) {
    const resolved = await resolveSensitiveApproval(
      "DISCOUNT",
      { id: req.user!.id, role: req.user!.role },
      storeSettings,
      approval,
      { ip: clientIp(req) ?? undefined }
    );
    if (!resolved.ok) {
      return res.status(resolved.status).json({ error: resolved.error, code: resolved.code });
    }
    discountApproverId = resolved.approverId;
  } else if (pct > 0) {
    discountApproverId = req.user!.id;
  }

  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
      const orderNumber = await nextPosOrderNumber(tx, resolvedBranchId);
      const db = tx as unknown as CashDb & { order: typeof prisma.order };
      const needsCashDrawer =
        payStatus === "PAID" && payValidation.cashDrawerMinor > 0;
      if (needsCashDrawer) {
        const shift = await tx.cashShift.findFirst({
          where: {
            branchId: resolvedBranchId,
            cashierId: req.user!.id,
            status: CashShiftStatus.OPEN,
          },
        });
        if (!shift) {
          throw Object.assign(new Error(SHIFT_REQUIRED_ERROR), {
            status: 403,
            code: SHIFT_REQUIRED_CODE,
          });
        }
      }
      const created = await tx.order.create({
        data: {
          orderNumber,
          branchId: resolvedBranchId,
          orderSource: OrderSource.POS,
          createdById: req.user!.id,
          fulfillmentType: mode,
          deliveryAreaId: areaId,
          subtotal: built.subtotal,
          deliveryCharge,
          taxAmount: quoted.tax,
          taxableAmount: enriched.orderTax.taxableAmount,
          taxRatePercentSnap: enriched.orderTax.taxRatePercentSnap,
          taxInclusiveSnap: enriched.orderTax.taxInclusiveSnap,
          taxSnapshotJson: enriched.orderTax.taxSnapshotJson,
          serviceAmount: quoted.service,
          discountAmount: discounted.discountAmount,
          discountPercent: pct > 0 ? pct : null,
          total: discounted.total,
          adjustmentReasonCode: pct > 0 ? String(discountReasonCode || "").trim() : null,
          adjustmentReasonNote: pct > 0 ? cleanText(discountReasonNote, 200) || null : null,
          adjustmentRequestedById: pct > 0 ? req.user!.id : null,
          adjustmentApprovedById: discountApproverId,
          deliveryAddress: address,
          notes: notes ? cleanText(notes, 400) || null : null,
          tableNumber: mode === FulfillmentType.DINE_IN ? resolvedTableNumber : null,
          diningTableId: mode === FulfillmentType.DINE_IN ? resolvedDiningTableId : null,
          tableSessionId: mode === FulfillmentType.DINE_IN ? resolvedSessionId : null,
          waiterId: mode === FulfillmentType.DINE_IN ? resolvedWaiterId : null,
          customerName: name,
          customerPhone: phone,
          paymentMethod: payMethod,
          paymentStatus: payStatus,
          status: OrderStatus.CONFIRMED,
          posClientOrderId: idemKey || null,
          payments:
            payStatus === "PAID"
              ? {
                  create: payValidation.normalized.map((p, sortOrder) => ({
                    method: p.method,
                    amount: p.amount,
                    tendered: p.tendered ?? null,
                    changeGiven: p.changeGiven ?? null,
                    sortOrder,
                  })),
                }
              : undefined,
          items: {
            create: enriched.lines.map((l) => ({
              menuItemId: l.menuItemId,
              quantity: l.quantity,
              priceAtOrder: l.priceAtOrder,
              nameAtOrder: l.nameAtOrder,
              optionsLabel: l.optionsLabel,
              instructions: l.instructions,
              lineTaxableAmount: l.lineTaxableAmount,
              lineTaxAmount: l.lineTaxAmount,
              lineTaxRatePercent: l.lineTaxRatePercent,
            })),
          },
        },
        include,
      });
      if (needsCashDrawer) {
        const shift = await tx.cashShift.findFirst({
          where: {
            branchId: resolvedBranchId,
            cashierId: req.user!.id,
            status: CashShiftStatus.OPEN,
          },
        });
        if (shift) {
          await recordCashMovement(db, {
            shiftId: shift.id,
            type: CashMovementType.SALE_CASH,
            amount: payValidation.cashDrawerMinor / 100,
            reason: `POS sale ${created.orderNumber}`,
            orderId: created.id,
            createdById: req.user!.id,
          });
        }
      }
      return created;
    });
  } catch (err) {
    const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 500;
    const code = typeof err === "object" && err && "code" in err ? String((err as { code: string }).code) : undefined;
    const message = err instanceof Error ? err.message : "Could not create order.";
    return res.status(status).json({ error: message, code });
  }

  if (pct > 0) {
    await writeAudit(prisma, {
      actorId: req.user!.id,
      actorRole: req.user!.role,
      branchId: resolvedBranchId,
      action: AuditAction.DISCOUNT_APPLIED,
      entityType: "order",
      entityId: order.id,
      after: { discountPercent: pct, discountAmount: discounted.discountAmount },
      reason: String(discountReasonCode || ""),
      ip: clientIp(req) ?? undefined,
    });
  }
  if (built.hadPriceOverride) {
    await writeAudit(prisma, {
      actorId: req.user!.id,
      actorRole: req.user!.role,
      branchId: resolvedBranchId,
      action: AuditAction.ITEM_PRICE_CHANGED,
      entityType: "order",
      entityId: order.id,
      after: { priceOverride: true },
      ip: clientIp(req) ?? undefined,
    });
  }
  emitOrderChange("order:created", order);
  const { deductInventoryForOrder } = await import("../lib/inventory/stock");
  void deductInventoryForOrder(order.id, req.user!.id).catch(() => null);
  if (payStatus === "PAID") {
    void issueTaxInvoiceForOrder(order.id).catch(() => null);
  }
  res.status(201).json(order);
});

posRouter.post(
  "/:orderId/void",
  requireAuth,
  requireRole(...ADMIN_LIKE, Role.CASHIER, Role.WAITER),
  async (req, res) => {
    const storeSettings = await getStoreSettings();
    const existing = await prisma.order.findUnique({ where: { id: req.params.orderId }, include });
    if (!existing || existing.orderSource !== OrderSource.POS) {
      return res.status(404).json({ error: "POS order not found." });
    }
    if (existing.status === OrderStatus.CANCELLED) {
      return res.status(400).json({ error: "Order is already voided." });
    }
    const { voidReasonCode, voidReasonNote, approval } = req.body as {
      voidReasonCode?: string;
      voidReasonNote?: string;
      approval?: { approverId?: string; pin?: string };
    };
    const reasons = parseReasonList(storeSettings.voidReasonOptions);
    const code = String(voidReasonCode || "").trim();
    if (!validateReasonCode(code, reasons)) {
      return res.status(400).json({ error: "Select a void reason." });
    }
    const resolved = await resolveSensitiveApproval(
      "VOID",
      { id: req.user!.id, role: req.user!.role },
      storeSettings,
      approval,
      { ip: clientIp(req) ?? undefined }
    );
    if (!resolved.ok) {
      return res.status(resolved.status).json({ error: resolved.error, code: resolved.code });
    }
    const order = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: existing.id },
        data: {
          status: OrderStatus.CANCELLED,
          voidReasonCode: code,
          voidReasonNote: cleanText(voidReasonNote, 200) || null,
          voidApprovedById: resolved.approverId,
          events: {
            create: {
              fromStatus: existing.status,
              toStatus: OrderStatus.CANCELLED,
              actorId: req.user!.id,
              actorRole: req.user!.role,
              reason: code,
            },
          },
        },
        include,
      });
      if (
        existing.paymentMethod === PaymentMethod.CASH &&
        existing.paymentStatus === "PAID" &&
        existing.branchId
      ) {
        await recordRefundCash(
          tx as unknown as CashDb,
          existing.branchId,
          req.user!.id,
          existing.id,
          Number(existing.total),
          `Void ${existing.orderNumber}`,
          req.user!.id
        );
      }
      await writeAudit(tx, {
        actorId: req.user!.id,
        actorRole: req.user!.role,
        branchId: existing.branchId,
        action: AuditAction.ORDER_VOIDED,
        entityType: "order",
        entityId: updated.id,
        before: { status: existing.status },
        after: { status: OrderStatus.CANCELLED },
        reason: code,
        ip: clientIp(req) ?? undefined,
      });
      return updated;
    });
    const { reverseInventoryForOrder } = await import("../lib/inventory/stock");
    void reverseInventoryForOrder(order.id, req.user!.id).catch(() => null);
    void issueCreditNoteForOrder(order.id).catch(() => null);
    emitOrderChange("order:updated", order);
    res.json(order);
  }
);

posRouter.post(
  "/:orderId/refund",
  requireAuth,
  requireRole(...ADMIN_LIKE, Role.CASHIER),
  async (req, res) => {
    const storeSettings = await getStoreSettings();
    const existing = await prisma.order.findUnique({ where: { id: req.params.orderId }, include });
    if (!existing || existing.orderSource !== OrderSource.POS) {
      return res.status(404).json({ error: "POS order not found." });
    }
    if (existing.status === OrderStatus.CANCELLED) {
      return res.status(400).json({ error: "Cannot refund a voided order." });
    }
    const { refundAmount, refundReasonCode, refundReasonNote, approval } = req.body as {
      refundAmount?: number;
      refundReasonCode?: string;
      refundReasonNote?: string;
      approval?: { approverId?: string; pin?: string };
    };
    const amount = Number(refundAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Enter a valid refund amount." });
    }
    if (amount > Number(existing.total)) {
      return res.status(400).json({ error: "Refund cannot exceed order total." });
    }
    const reasons = parseReasonList(storeSettings.refundReasonOptions);
    const code = String(refundReasonCode || "").trim();
    if (!validateReasonCode(code, reasons)) {
      return res.status(400).json({ error: "Select a refund reason." });
    }
    const resolved = await resolveSensitiveApproval(
      "REFUND",
      { id: req.user!.id, role: req.user!.role },
      storeSettings,
      approval,
      { ip: clientIp(req) ?? undefined }
    );
    if (!resolved.ok) {
      return res.status(resolved.status).json({ error: resolved.error, code: resolved.code });
    }

    const order = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: existing.id },
        data: {
          refundAmount: amount,
          refundReasonCode: code,
          refundReasonNote: cleanText(refundReasonNote, 200) || null,
          refundApprovedById: resolved.approverId,
          paymentStatus: amount >= Number(existing.total) ? "REFUNDED" : "PARTIAL_REFUND",
        },
        include,
      });
      await writeAudit(tx, {
        actorId: req.user!.id,
        actorRole: req.user!.role,
        branchId: existing.branchId,
        action: AuditAction.REFUND_ISSUED,
        entityType: "order",
        entityId: updated.id,
        after: { refundAmount: amount },
        reason: code,
        ip: clientIp(req) ?? undefined,
      });
      if (existing.paymentMethod === PaymentMethod.CASH && existing.branchId) {
        await recordRefundCash(
          tx as unknown as CashDb,
          existing.branchId,
          req.user!.id,
          existing.id,
          amount,
          `Refund ${existing.orderNumber}`,
          req.user!.id
        );
      }
      return updated;
    });
    emitOrderChange("order:updated", order);
    res.json(order);
  }
);

posRouter.post(
  "/sync",
  posLimiter,
  requireAuth,
  requireRole(...ADMIN_LIKE, Role.CASHIER, Role.WAITER),
  async (req, res) => {
    const body = req.body as PosSyncInput;
    const gate = validateOfflineSyncPayload(body);
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error });

    const storeSettings = await getStoreSettings();
    const storeAddress = `${storeNameFrom(storeSettings)} — ${storeSettings.address}`;

    let scope;
    try {
      scope = await resolveBranchScope(req);
    } catch (err) {
      return branchScopeError(res, err);
    }
    const resolvedBranchId = scope.allBranches ? await getDefaultBranchId() : scope.branchId!;

    try {
      const result = await syncPosOrderFromOffline(
        req.user!.id,
        resolvedBranchId,
        body,
        storeAddress
      );
      const { order, created, conflict } = result;
      if (created) {
        await writeAudit(prisma, {
          action: conflict ? AuditAction.POS_OFFLINE_SYNC_CONFLICT : AuditAction.POS_OFFLINE_SYNC_CREATED,
          actorId: req.user!.id,
          branchId: resolvedBranchId,
          entityType: "Order",
          entityId: order.id,
          meta: {
            posClientOrderId: body.clientOrderId,
            offlineLabel: body.offlineLabel,
            offlineClientCreatedAt: body.clientCreatedAt,
            deviceLabel: body.deviceLabel,
            needsReview: conflict,
          },
          ip: clientIp(req) ?? undefined,
        });
        emitOrderChange("order:created", order);
      }
      return res.json({
        order,
        created,
        conflict,
        offlineLabel: body.offlineLabel,
      });
    } catch (err) {
      const status = (err as { status?: number }).status ?? 500;
      const message = err instanceof Error ? err.message : "Sync failed.";
      if (status >= 400 && status < 500) {
        await writeAudit(prisma, {
          action: AuditAction.POS_OFFLINE_SYNC_REJECTED,
          actorId: req.user!.id,
          branchId: resolvedBranchId,
          entityType: "PosSync",
          entityId: body.clientOrderId,
          meta: {
            offlineLabel: body.offlineLabel,
            deviceLabel: body.deviceLabel,
            error: message,
          },
          ip: clientIp(req) ?? undefined,
        });
      }
      const code = (err as { code?: string }).code;
      return res.status(status).json({ error: message, code });
    }
  }
);

posRouter.post(
  "/sync/cash-movement",
  posLimiter,
  requireAuth,
  requireRole(...ADMIN_LIKE, Role.CASHIER, Role.WAITER),
  async (req, res) => {
    const body = req.body as PosCashMovementSyncInput;
    let scope;
    try {
      scope = await resolveBranchScope(req);
    } catch (err) {
      return branchScopeError(res, err);
    }
    const resolvedBranchId = scope.allBranches ? await getDefaultBranchId() : scope.branchId!;
    try {
      const result = await syncPosCashMovementFromOffline(req.user!.id, resolvedBranchId, body);
      return res.json(result);
    } catch (err) {
      const status = (err as { status?: number }).status ?? 500;
      const message = err instanceof Error ? err.message : "Sync failed.";
      const code = (err as { code?: string }).code;
      return res.status(status).json({ error: message, code });
    }
  }
);

posRouter.post(
  "/offline-logout-override",
  requireAuth,
  requireRole(...ADMIN_LIKE, Role.MANAGER),
  async (req, res) => {
    const { pendingCount, deviceLabel } = req.body as { pendingCount?: number; deviceLabel?: string };
    let scope;
    try {
      scope = await resolveBranchScope(req);
    } catch (err) {
      return branchScopeError(res, err);
    }
    const branchId = scope.allBranches ? await getDefaultBranchId() : scope.branchId!;
    await writeAudit(prisma, {
      action: AuditAction.POS_OFFLINE_LOGOUT_OVERRIDE,
      actorId: req.user!.id,
      actorRole: req.user!.role,
      branchId,
      entityType: "PosSync",
      entityId: req.user!.id,
      meta: { pendingCount, deviceLabel },
      ip: clientIp(req) ?? undefined,
    });
    res.json({ ok: true });
  }
);

posRouter.post(
  "/offline-discard",
  requireAuth,
  requireRole(...ADMIN_LIKE, Role.MANAGER, Role.CASHIER),
  async (req, res) => {
    const { clientOrderId, offlineLabel, deviceLabel } = req.body as {
      clientOrderId?: string;
      offlineLabel?: string;
      deviceLabel?: string;
    };
    if (!clientOrderId?.trim()) {
      return res.status(400).json({ error: "clientOrderId is required." });
    }
    let scope;
    try {
      scope = await resolveBranchScope(req);
    } catch (err) {
      return branchScopeError(res, err);
    }
    const branchId = scope.allBranches ? await getDefaultBranchId() : scope.branchId!;
    await writeAudit(prisma, {
      action: AuditAction.POS_OFFLINE_QUEUE_DISCARDED,
      actorId: req.user!.id,
      actorRole: req.user!.role,
      branchId,
      entityType: "PosSync",
      entityId: clientOrderId.trim(),
      meta: { offlineLabel, deviceLabel },
      ip: clientIp(req) ?? undefined,
    });
    res.json({ ok: true });
  }
);

posRouter.get(
  "/sync-conflicts",
  requireAuth,
  requireRole(...ADMIN_LIKE, Role.MANAGER),
  async (req, res) => {
    let scope;
    try {
      scope = await resolveBranchScope(req);
    } catch (err) {
      return branchScopeError(res, err);
    }
    const branchId = scope.allBranches ? undefined : scope.branchId!;
    const orders = await prisma.order.findMany({
      where: {
        needsReview: true,
        ...(branchId ? { branchId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        items: true,
        createdBy: { select: { id: true, name: true } },
      },
    });
    res.json({ orders });
  }
);

posRouter.get(
  "/popular-menu",
  requireAuth,
  requireRole(...ADMIN_LIKE, Role.CASHIER, Role.WAITER),
  async (req, res) => {
    let scope;
    try {
      scope = await resolveBranchScope(req);
    } catch (err) {
      return branchScopeError(res, err);
    }
    const branchId = scope.allBranches ? await getDefaultBranchId() : scope.branchId!;
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 30));
    const limit = Math.min(24, Math.max(1, Number(req.query.limit) || 12));
    const popular = await posPopularMenuItemIds(branchId, days, limit);
    res.json({ popular, days });
  }
);

posRouter.get(
  "/recent",
  requireAuth,
  requireRole(...ADMIN_LIKE, Role.CASHIER, Role.WAITER),
  async (req, res) => {
    let scope;
    try {
      scope = await resolveBranchScope(req);
    } catch (err) {
      return branchScopeError(res, err);
    }
    const branchId = scope.allBranches ? await getDefaultBranchId() : scope.branchId!;
    const orders = await listRecentPosOrders(branchId, req.user!.id);
    res.json({ orders });
  }
);

posRouter.post(
  "/holds",
  requireAuth,
  requireRole(...ADMIN_LIKE, Role.CASHIER, Role.WAITER),
  async (req, res) => {
    const { label, payload, holdHours } = req.body as {
      label?: string;
      payload?: Record<string, unknown>;
      holdHours?: number;
    };
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ error: "Hold payload is required." });
    }
    let scope;
    try {
      scope = await resolveBranchScope(req);
    } catch (err) {
      return branchScopeError(res, err);
    }
    const branchId = scope.allBranches ? await getDefaultBranchId() : scope.branchId!;
    const hours = Number(holdHours);
    const hold = await createPosHold(
      branchId,
      req.user!.id,
      payload,
      label,
      Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_POS_HOLD_HOURS
    );
    res.status(201).json({ hold });
  }
);

posRouter.get(
  "/holds",
  requireAuth,
  requireRole(...ADMIN_LIKE, Role.CASHIER, Role.WAITER),
  async (req, res) => {
    let scope;
    try {
      scope = await resolveBranchScope(req);
    } catch (err) {
      return branchScopeError(res, err);
    }
    const branchId = scope.allBranches ? await getDefaultBranchId() : scope.branchId!;
    const shared = req.query.shared === "1" || req.query.shared === "true";
    const holds = await listPosHolds(branchId, shared ? undefined : req.user!.id);
    res.json({ holds });
  }
);

posRouter.get(
  "/holds/:holdId",
  requireAuth,
  requireRole(...ADMIN_LIKE, Role.CASHIER, Role.WAITER),
  async (req, res) => {
    let scope;
    try {
      scope = await resolveBranchScope(req);
    } catch (err) {
      return branchScopeError(res, err);
    }
    const branchId = scope.allBranches ? await getDefaultBranchId() : scope.branchId!;
    const hold = await getPosHoldForBranch(branchId, req.params.holdId);
    if (!hold) return res.status(404).json({ error: "Hold not found or expired." });
    res.json({ hold });
  }
);

posRouter.post(
  "/holds/:holdId/resume",
  requireAuth,
  requireRole(...ADMIN_LIKE, Role.CASHIER, Role.WAITER),
  async (req, res) => {
    let scope;
    try {
      scope = await resolveBranchScope(req);
    } catch (err) {
      return branchScopeError(res, err);
    }
    const branchId = scope.allBranches ? await getDefaultBranchId() : scope.branchId!;
    const hold = await getPosHoldForBranch(branchId, req.params.holdId);
    if (!hold) return res.status(404).json({ error: "Hold not found or expired." });
    await prisma.posHold.delete({ where: { id: hold.id } });
    res.json({ hold });
  }
);

posRouter.delete(
  "/holds/:holdId",
  requireAuth,
  requireRole(...ADMIN_LIKE, Role.CASHIER, Role.WAITER),
  async (req, res) => {
    let scope;
    try {
      scope = await resolveBranchScope(req);
    } catch (err) {
      return branchScopeError(res, err);
    }
    const branchId = scope.allBranches ? await getDefaultBranchId() : scope.branchId!;
    const hold = await getPosHoldForBranch(branchId, req.params.holdId);
    if (!hold) return res.status(404).json({ error: "Hold not found or expired." });
    await prisma.posHold.delete({ where: { id: hold.id } });
    res.json({ ok: true });
  }
);

posRouter.get(
  "/receipt/:orderId",
  requireAuth,
  requireRole(...ADMIN_LIKE, Role.CASHIER, Role.WAITER),
  async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.orderId },
      include: {
        items: true,
        deliveryArea: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    });
    if (!order) return res.status(404).json({ error: "Order not found." });
    if (order.orderSource !== OrderSource.POS) {
      return res.status(403).json({ error: "Receipt is only available for POS orders." });
    }
    const settings = await getStoreSettings();
    res.json({
      order,
      store: {
        name: storeNameFrom(settings),
        phone: settings.phone,
        address: settings.address,
        whatsapp: settings.whatsapp,
        footer: settings.receiptFooter,
        taxNumber: settings.taxNumber,
        taxStrn: settings.taxStrn,
        taxLabel: settings.taxLabel,
      },
    });
  }
);
