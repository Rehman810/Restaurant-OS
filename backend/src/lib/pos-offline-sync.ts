import {
  CashMovementType,
  CashShiftStatus,
  FulfillmentType,
  OrderSource,
  OrderStatus,
  PaymentMethod,
} from "@prisma/client";
import { prisma } from "./prisma";
import { buildOrderLines, type CartDealInput, type CartItemInput } from "./order-lines";
import { nextPosOrderNumber } from "./pos-order-number";
import { clientClockSkewMinutes, clockSkewFlag as skewExceeds } from "./pos-clock-skew";
import { quoteCharges, applyOrderDiscount } from "./charges";
import { enrichLinesWithTax } from "./tax/apply";
import { issueTaxInvoiceForOrder } from "./tax/invoicing";
import { getStoreSettings } from "./settings-data";
import { cleanText } from "./text";
import { recordCashMovement, SHIFT_REQUIRED_CODE, SHIFT_REQUIRED_ERROR, type CashDb } from "./cash-shift";

const TOTAL_EPS = 0.02;

export type PosSyncInput = {
  clientOrderId: string;
  offlineLabel: string;
  clientCreatedAt: string;
  deviceLabel: string;
  clientClaimedTotal?: number;
  items?: CartItemInput[];
  deals?: CartDealInput[];
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
  discountPercent?: number;
};

export function validateOfflineSyncPayload(body: PosSyncInput) {
  if (!body.clientOrderId?.trim()) {
    return { ok: false as const, status: 400, error: "clientOrderId is required." };
  }
  if (body.discountPercent && Number(body.discountPercent) > 0) {
    return { ok: false as const, status: 400, error: "Discounts cannot be synced from offline queue." };
  }
  const pay = body.paymentMethod === PaymentMethod.CARD ? PaymentMethod.CARD : PaymentMethod.CASH;
  if (pay === PaymentMethod.CARD) {
    return { ok: false as const, status: 400, error: "Only cash payments can be synced offline." };
  }
  if (body.fulfillmentType === FulfillmentType.DELIVERY) {
    return { ok: false as const, status: 400, error: "Delivery orders cannot be created offline." };
  }
  const hasOverride = (body.items ?? []).some(
    (i) => i.unitPriceOverride != null && Number.isFinite(Number(i.unitPriceOverride))
  );
  if (hasOverride) {
    return { ok: false as const, status: 400, error: "Price overrides cannot be synced offline." };
  }
  return { ok: true as const };
}

export async function syncPosOrderFromOffline(
  userId: string,
  branchId: string,
  body: PosSyncInput,
  storeAddress: string
) {
  const settings = await getStoreSettings();
  if (!settings.offlinePosEnabled) {
    throw Object.assign(new Error("Offline POS is disabled for this store."), { status: 403 });
  }

  const gate = validateOfflineSyncPayload(body);
  if (!gate.ok) {
    throw Object.assign(new Error(gate.error), { status: gate.status });
  }

  const existing = await prisma.order.findUnique({
    where: { posClientOrderId: body.clientOrderId.trim() },
    include: { items: true },
  });
  if (existing) {
    return { order: existing, created: false, conflict: existing.needsReview };
  }

  const built = await buildOrderLines(body.items ?? [], body.deals ?? [], { skipUnavailable: true });
  const reviewReasons: string[] = [];
  if (!built.ok) {
    throw Object.assign(new Error(built.error), { status: built.status });
  }
  if (built.warnings?.length) {
    reviewReasons.push(...built.warnings);
  }

  const mode =
    body.fulfillmentType === FulfillmentType.DINE_IN
      ? FulfillmentType.DINE_IN
      : FulfillmentType.PICKUP;

  let address = storeAddress;
  let resolvedTableNumber: string | null = null;
  if (mode === FulfillmentType.DINE_IN) {
    address = body.tableNumber?.trim()
      ? `Dine-in · Table ${body.tableNumber.trim()}`
      : "Dine-in · Counter";
    resolvedTableNumber = body.tableNumber?.trim() || null;
  }

  const taxCtx = { fulfillmentType: mode, paymentMethod: PaymentMethod.CASH };
  const enriched = enrichLinesWithTax(built.lines, settings, taxCtx);
  const quoted = quoteCharges(built.subtotal, 0, settings, taxCtx);
  const discounted = applyOrderDiscount(quoted, null, null);
  const serverTotal = discounted.total;

  if (
    body.clientClaimedTotal != null &&
    Math.abs(Number(body.clientClaimedTotal) - serverTotal) > TOTAL_EPS
  ) {
    reviewReasons.push(
      `Client total ${body.clientClaimedTotal} differs from server ${serverTotal.toFixed(2)}.`
    );
  }

  const clientCreated = new Date(body.clientCreatedAt);
  const clientCreatedAt = Number.isNaN(clientCreated.getTime()) ? new Date() : clientCreated;
  const serverReceivedAt = new Date();
  const skewMin = clientClockSkewMinutes(clientCreatedAt, serverReceivedAt);
  const threshold = settings.offlineClockSkewThresholdMinutes ?? 10;
  const skewFlag = skewExceeds(skewMin, threshold);
  if (skewFlag) {
    reviewReasons.push(`Client clock differs from server by ${skewMin} minutes.`);
  }
  const finalNeedsReview = reviewReasons.length > 0;

  const order = await prisma.$transaction(async (tx) => {
    const orderNumber = await nextPosOrderNumber(tx, branchId, serverReceivedAt);
    const shift = await tx.cashShift.findFirst({
      where: { branchId, cashierId: userId, status: CashShiftStatus.OPEN },
    });
    if (!shift) {
      throw Object.assign(new Error(SHIFT_REQUIRED_ERROR), { status: 403, code: SHIFT_REQUIRED_CODE });
    }

    const created = await tx.order.create({
      data: {
        orderNumber,
        branchId,
        orderSource: OrderSource.POS,
        createdById: userId,
        fulfillmentType: mode,
        subtotal: built.subtotal,
        deliveryCharge: 0,
        taxAmount: quoted.tax,
        taxableAmount: enriched.orderTax.taxableAmount,
        taxRatePercentSnap: enriched.orderTax.taxRatePercentSnap,
        taxInclusiveSnap: enriched.orderTax.taxInclusiveSnap,
        taxSnapshotJson: enriched.orderTax.taxSnapshotJson,
        serviceAmount: quoted.service,
        discountAmount: discounted.discountAmount,
        total: serverTotal,
        deliveryAddress: address,
        notes: body.notes ? cleanText(body.notes, 400) || null : null,
        tableNumber: resolvedTableNumber,
        diningTableId: body.diningTableId || null,
        tableSessionId: body.tableSessionId || null,
        waiterId: body.waiterId || null,
        customerName: cleanText(body.customerName, 80) || "Walk-in",
        customerPhone: body.customerPhone?.trim() || "",
        paymentMethod: PaymentMethod.CASH,
        paymentStatus: "PAID",
        status: OrderStatus.CONFIRMED,
        posClientOrderId: body.clientOrderId.trim(),
        offlineLabel: body.offlineLabel?.trim() || null,
        offlineClientCreatedAt: clientCreatedAt,
        offlineDeviceLabel: body.deviceLabel?.trim() || null,
        clientClaimedTotal: body.clientClaimedTotal ?? null,
        needsReview: finalNeedsReview,
        needsReviewReason: finalNeedsReview ? reviewReasons.join(" ") : null,
        serverReceivedAt,
        clientClockSkewMinutes: skewMin,
        clockSkewFlag: skewFlag,
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
      include: { items: true },
    });

    await recordCashMovement(tx as unknown as CashDb, {
      shiftId: shift.id,
      type: CashMovementType.SALE_CASH,
      amount: serverTotal,
      reason: finalNeedsReview
        ? `Offline sync ${body.offlineLabel} (needs review)`
        : `Offline sync ${body.offlineLabel}`,
      orderId: created.id,
      createdById: userId,
    });

    return created;
  });

  void issueTaxInvoiceForOrder(order.id).catch(() => null);

  const conflict = order.needsReview;
  return { order, created: true, conflict };
}

export type PosCashMovementSyncInput = {
  clientMovementId: string;
  type: "PAID_IN" | "PAID_OUT";
  amount: number;
  reason: string;
  clientCreatedAt: string;
  deviceLabel: string;
};

export async function syncPosCashMovementFromOffline(
  userId: string,
  branchId: string,
  body: PosCashMovementSyncInput
) {
  const settings = await getStoreSettings();
  if (!settings.offlinePosEnabled) {
    throw Object.assign(new Error("Offline POS is disabled for this store."), { status: 403 });
  }
  if (!body.clientMovementId?.trim()) {
    throw Object.assign(new Error("clientMovementId is required."), { status: 400 });
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw Object.assign(new Error("Invalid amount."), { status: 400 });
  }
  const type =
    body.type === "PAID_OUT" ? CashMovementType.PAID_OUT : CashMovementType.PAID_IN;

  const existing = await prisma.cashMovement.findUnique({
    where: { posClientMovementId: body.clientMovementId.trim() },
  });
  if (existing) return { movement: existing, created: false };

  const clientCreated = new Date(body.clientCreatedAt);
  const clientCreatedAt = Number.isNaN(clientCreated.getTime()) ? new Date() : clientCreated;

  const movement = await prisma.$transaction(async (tx) => {
    const shift = await tx.cashShift.findFirst({
      where: { branchId, cashierId: userId, status: CashShiftStatus.OPEN },
    });
    if (!shift) {
      throw Object.assign(new Error(SHIFT_REQUIRED_ERROR), { status: 403, code: SHIFT_REQUIRED_CODE });
    }
    return recordCashMovement(tx as unknown as CashDb, {
      shiftId: shift.id,
      type,
      amount,
      reason: cleanText(body.reason, 200) || (type === CashMovementType.PAID_IN ? "Paid in" : "Paid out"),
      createdById: userId,
      posClientMovementId: body.clientMovementId.trim(),
      offlineClientCreatedAt: clientCreatedAt,
      offlineDeviceLabel: body.deviceLabel?.trim() || null,
    });
  });

  return { movement, created: true };
}
