import type { Prisma, StoreSettings } from "@prisma/client";
import { prisma } from "./prisma";
import { getStoreSettings } from "./settings-data";
import { normalizeSettingsPatch } from "./settings-validate";
import type { SettingsSectionId } from "./settings-sections";
import { legacySlaMirrorFromAlertThresholds } from "./order-alert-thresholds";
import { pickSectionPatch, sectionFieldValues } from "./settings-section-fields";

const num = (v: unknown) => (v === undefined || v === "" ? undefined : Number(v));

const hour = (v: unknown) => {
  if (v === undefined || v === "") return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 23) return null;
  return Math.floor(n);
};

const minute = (v: unknown) => {
  if (v === undefined || v === "") return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 59) return null;
  return Math.floor(n);
};

/** Map validated PATCH body to Prisma StoreSettings update fields. */
export function buildStoreSettingsUpdateData(body: Record<string, unknown>): Prisma.StoreSettingsUpdateInput {
  return {
    ...(body.storeName !== undefined ? { storeName: String(body.storeName).trim() } : {}),
    ...(body.logoUrl !== undefined ? { logoUrl: String(body.logoUrl).trim() } : {}),
    ...(body.faviconUrl !== undefined ? { faviconUrl: String(body.faviconUrl).trim() } : {}),
    ...(body.primaryColor !== undefined ? { primaryColor: String(body.primaryColor).trim() || "#ea580c" } : {}),
    ...(body.accentColor !== undefined ? { accentColor: String(body.accentColor).trim() || "#c2410c" } : {}),
    ...(body.city !== undefined ? { city: String(body.city).trim() } : {}),
    ...(body.timezone !== undefined ? { timezone: String(body.timezone).trim() || "Asia/Karachi" } : {}),
    ...(body.currencyCode !== undefined
      ? { currencyCode: String(body.currencyCode).trim().toUpperCase() || "PKR" }
      : {}),
    ...(body.currencySymbol !== undefined ? { currencySymbol: String(body.currencySymbol).trim() || "Rs" } : {}),
    ...(body.footerText !== undefined ? { footerText: String(body.footerText) } : {}),
    ...(body.showLiveStats !== undefined ? { showLiveStats: Boolean(body.showLiveStats) } : {}),
    ...(body.showReviewsSection !== undefined ? { showReviewsSection: Boolean(body.showReviewsSection) } : {}),
    ...(body.inventoryAutoHideMenu !== undefined
      ? { inventoryAutoHideMenu: Boolean(body.inventoryAutoHideMenu) }
      : {}),
    ...(body.inventoryAllowNegative !== undefined
      ? { inventoryAllowNegative: Boolean(body.inventoryAllowNegative) }
      : {}),
    ...(body.inventoryDeductAtPreparing !== undefined
      ? { inventoryDeductAtPreparing: Boolean(body.inventoryDeductAtPreparing) }
      : {}),
    ...(body.maxCashierDiscountPercent !== undefined
      ? { maxCashierDiscountPercent: num(body.maxCashierDiscountPercent) ?? 10 }
      : {}),
    ...(body.requireApprovalForVoid !== undefined
      ? { requireApprovalForVoid: Boolean(body.requireApprovalForVoid) }
      : {}),
    ...(body.requireApprovalForRefund !== undefined
      ? { requireApprovalForRefund: Boolean(body.requireApprovalForRefund) }
      : {}),
    ...(body.requireApprovalForPriceOverride !== undefined
      ? { requireApprovalForPriceOverride: Boolean(body.requireApprovalForPriceOverride) }
      : {}),
    ...(body.voidReasonOptions !== undefined ? { voidReasonOptions: body.voidReasonOptions as object } : {}),
    ...(body.discountReasonOptions !== undefined
      ? { discountReasonOptions: body.discountReasonOptions as object }
      : {}),
    ...(body.refundReasonOptions !== undefined ? { refundReasonOptions: body.refundReasonOptions as object } : {}),
    ...(body.shiftVarianceTolerance !== undefined
      ? { shiftVarianceTolerance: num(body.shiftVarianceTolerance) ?? 500 }
      : {}),
    ...(body.riderCashStaleHours !== undefined
      ? { riderCashStaleHours: Number(body.riderCashStaleHours) || 24 }
      : {}),
    ...(body.lateConfirmMinutes !== undefined
      ? { lateConfirmMinutes: Math.max(1, Math.floor(Number(body.lateConfirmMinutes) || 15)) }
      : {}),
    ...(body.latePrepMinutes !== undefined
      ? { latePrepMinutes: Math.max(1, Math.floor(Number(body.latePrepMinutes) || 30)) }
      : {}),
    ...(body.lateDeliveryMinutes !== undefined
      ? { lateDeliveryMinutes: Math.max(1, Math.floor(Number(body.lateDeliveryMinutes) || 45)) }
      : {}),
    ...(body.ordersStaleHours !== undefined
      ? { ordersStaleHours: Math.max(1, Math.floor(Number(body.ordersStaleHours) || 2)) }
      : {}),
    ...(body.duplicateOrderWindowMinutes !== undefined
      ? {
          duplicateOrderWindowMinutes: Math.max(
            1,
            Math.floor(Number(body.duplicateOrderWindowMinutes) || 10)
          ),
        }
      : {}),
    ...(body.trackingCompletedWindowHours !== undefined
      ? {
          trackingCompletedWindowHours: Math.max(
            0,
            Math.floor(Number(body.trackingCompletedWindowHours) || 0)
          ),
        }
      : {}),
    ...(body.shiftOpenWarningHours !== undefined
      ? { shiftOpenWarningHours: Math.max(1, Math.floor(Number(body.shiftOpenWarningHours) || 12)) }
      : {}),
    ...(body.lowRatingThreshold !== undefined
      ? { lowRatingThreshold: Math.min(5, Math.max(1, Math.floor(Number(body.lowRatingThreshold) || 2))) }
      : {}),
    ...(body.twoFaReminderDays !== undefined
      ? { twoFaReminderDays: Math.max(1, Math.floor(Number(body.twoFaReminderDays) || 7)) }
      : {}),
    ...(body.weekStartDay !== undefined
      ? { weekStartDay: Math.min(6, Math.max(0, Math.floor(Number(body.weekStartDay) || 1))) }
      : {}),
    ...(body.analyticsInsightMinDays !== undefined
      ? { analyticsInsightMinDays: Math.max(1, Math.floor(Number(body.analyticsInsightMinDays) || 7)) }
      : {}),
    ...(body.analyticsInsightMinOrders !== undefined
      ? { analyticsInsightMinOrders: Math.max(1, Math.floor(Number(body.analyticsInsightMinOrders) || 20)) }
      : {}),
    ...(body.analyticsEmailEnabled !== undefined
      ? { analyticsEmailEnabled: Boolean(body.analyticsEmailEnabled) }
      : {}),
    ...(body.analyticsEmailFrequency !== undefined
      ? {
          analyticsEmailFrequency: String(body.analyticsEmailFrequency) === "daily" ? "daily" : "weekly",
        }
      : {}),
    ...(body.analyticsEmailRecipients !== undefined
      ? { analyticsEmailRecipients: String(body.analyticsEmailRecipients) }
      : {}),
    ...(body.analyticsEmailSendHour !== undefined
      ? {
          analyticsEmailSendHour: Math.min(23, Math.max(0, Math.floor(Number(body.analyticsEmailSendHour) || 8))),
        }
      : {}),
    ...(body.dailyCloseoutEmailEnabled !== undefined
      ? { dailyCloseoutEmailEnabled: Boolean(body.dailyCloseoutEmailEnabled) }
      : {}),
    ...(body.dailyCloseoutEmailRecipients !== undefined
      ? { dailyCloseoutEmailRecipients: String(body.dailyCloseoutEmailRecipients) }
      : {}),
    ...(body.dailyCloseoutEmailSendHour !== undefined
      ? {
          dailyCloseoutEmailSendHour: Math.min(
            23,
            Math.max(0, Math.floor(Number(body.dailyCloseoutEmailSendHour) || 23))
          ),
        }
      : {}),
    ...(body.dailyCloseoutEmailSendMinute !== undefined
      ? {
          dailyCloseoutEmailSendMinute: Math.min(
            59,
            Math.max(0, Math.floor(Number(body.dailyCloseoutEmailSendMinute) || 30))
          ),
        }
      : {}),
    ...(body.offlinePosEnabled !== undefined ? { offlinePosEnabled: Boolean(body.offlinePosEnabled) } : {}),
    ...(body.offlineClockSkewThresholdMinutes !== undefined
      ? {
          offlineClockSkewThresholdMinutes: Math.max(
            1,
            Math.floor(Number(body.offlineClockSkewThresholdMinutes) || 10)
          ),
        }
      : {}),
    ...(body.storefrontPushEnabled !== undefined
      ? { storefrontPushEnabled: Boolean(body.storefrontPushEnabled) }
      : {}),
    ...(body.autoPrintKitchenTickets !== undefined
      ? { autoPrintKitchenTickets: Boolean(body.autoPrintKitchenTickets) }
      : {}),
    ...(body.storeTagline !== undefined
      ? { storeTagline: String(body.storeTagline).trim() || "Order in minutes" }
      : {}),
    ...(body.phone !== undefined ? { phone: String(body.phone) } : {}),
    ...(body.whatsapp !== undefined ? { whatsapp: String(body.whatsapp) } : {}),
    ...(body.address !== undefined ? { address: String(body.address) } : {}),
    ...(body.latitude !== undefined ? { latitude: num(body.latitude) } : {}),
    ...(body.longitude !== undefined ? { longitude: num(body.longitude) } : {}),
    ...(body.minimumOrder !== undefined ? { minimumOrder: num(body.minimumOrder) ?? 0 } : {}),
    ...(body.freeDeliveryAbove !== undefined
      ? { freeDeliveryAbove: body.freeDeliveryAbove === null ? null : num(body.freeDeliveryAbove) }
      : {}),
    ...(body.deliveryEstimateMin !== undefined
      ? { deliveryEstimateMin: Number(body.deliveryEstimateMin) || 45 }
      : {}),
    ...(body.pickupEstimateMin !== undefined
      ? { pickupEstimateMin: Number(body.pickupEstimateMin) || 20 }
      : {}),
    ...(body.openHour !== undefined ? { openHour: hour(body.openHour) ?? 0 } : {}),
    ...(body.openMinute !== undefined ? { openMinute: minute(body.openMinute) ?? 0 } : {}),
    ...(body.closeHour !== undefined ? { closeHour: hour(body.closeHour) ?? 23 } : {}),
    ...(body.closeMinute !== undefined ? { closeMinute: minute(body.closeMinute) ?? 59 } : {}),
    ...(body.weeklySchedule !== undefined ? { weeklySchedule: body.weeklySchedule as object } : {}),
    ...(body.closedMessage !== undefined ? { closedMessage: String(body.closedMessage) } : {}),
    ...(body.forceClosed !== undefined ? { forceClosed: Boolean(body.forceClosed) } : {}),
    ...(body.specialHours !== undefined ? { specialHours: body.specialHours as object } : {}),
    ...(body.onlineCloseReason !== undefined ? { onlineCloseReason: String(body.onlineCloseReason) } : {}),
    ...(body.onlineReopenAt !== undefined
      ? { onlineReopenAt: body.onlineReopenAt ? new Date(String(body.onlineReopenAt)) : null }
      : {}),
    ...(body.onlineClosedAt !== undefined
      ? { onlineClosedAt: body.onlineClosedAt ? new Date(String(body.onlineClosedAt)) : null }
      : {}),
    ...(body.onlineClosedByUserId !== undefined
      ? { onlineClosedByUserId: body.onlineClosedByUserId ? String(body.onlineClosedByUserId) : null }
      : {}),
    ...(body.lastOrderCutoffMinutes !== undefined
      ? { lastOrderCutoffMinutes: Math.max(0, Math.floor(Number(body.lastOrderCutoffMinutes) || 0)) }
      : {}),
    ...(body.taxPercent !== undefined ? { taxPercent: num(body.taxPercent) ?? 0 } : {}),
    ...(body.taxLabel !== undefined ? { taxLabel: String(body.taxLabel).trim() || "Tax" } : {}),
    ...(body.taxIncluded !== undefined ? { taxIncluded: Boolean(body.taxIncluded) } : {}),
    ...(body.serviceChargePercent !== undefined
      ? { serviceChargePercent: num(body.serviceChargePercent) ?? 0 }
      : {}),
    ...(body.serviceChargeLabel !== undefined
      ? { serviceChargeLabel: String(body.serviceChargeLabel).trim() || "Service charge" }
      : {}),
    ...(body.serviceIncluded !== undefined ? { serviceIncluded: Boolean(body.serviceIncluded) } : {}),
    ...(body.acceptCash !== undefined ? { acceptCash: Boolean(body.acceptCash) } : {}),
    ...(body.acceptCard !== undefined ? { acceptCard: Boolean(body.acceptCard) } : {}),
    ...(body.taxNumber !== undefined ? { taxNumber: String(body.taxNumber).trim() } : {}),
    ...(body.taxEnabled !== undefined ? { taxEnabled: Boolean(body.taxEnabled) } : {}),
    ...(body.taxLegalName !== undefined ? { taxLegalName: String(body.taxLegalName).trim() } : {}),
    ...(body.taxBusinessAddress !== undefined
      ? { taxBusinessAddress: String(body.taxBusinessAddress).trim() }
      : {}),
    ...(body.taxStrn !== undefined ? { taxStrn: String(body.taxStrn).trim() } : {}),
    ...(body.pricesIncludeTax !== undefined ? { pricesIncludeTax: Boolean(body.pricesIncludeTax) } : {}),
    ...(body.taxFiscalYearEnabled !== undefined
      ? { taxFiscalYearEnabled: Boolean(body.taxFiscalYearEnabled) }
      : {}),
    ...(body.taxRatesByFulfillment !== undefined
      ? { taxRatesByFulfillment: body.taxRatesByFulfillment as object }
      : {}),
    ...(body.taxRatesByPayment !== undefined
      ? { taxRatesByPayment: body.taxRatesByPayment as object }
      : {}),
    ...(body.taxRoundingRule !== undefined
      ? { taxRoundingRule: String(body.taxRoundingRule).trim() || "HALF_UP" }
      : {}),
    ...(body.receiptFooter !== undefined ? { receiptFooter: String(body.receiptFooter) } : {}),
    ...(body.confirmSlaMinutes !== undefined
      ? { confirmSlaMinutes: Number(body.confirmSlaMinutes) || 15 }
      : {}),
    ...(body.deliverySlaMinutes !== undefined
      ? { deliverySlaMinutes: Number(body.deliverySlaMinutes) || 45 }
      : {}),
    ...(body.autoConfirmOrders !== undefined ? { autoConfirmOrders: Boolean(body.autoConfirmOrders) } : {}),
    ...(body.autoAssignRiders !== undefined ? { autoAssignRiders: Boolean(body.autoAssignRiders) } : {}),
    ...(body.emailNotifyAdmin !== undefined ? { emailNotifyAdmin: Boolean(body.emailNotifyAdmin) } : {}),
    ...(body.emailNotifyManager !== undefined ? { emailNotifyManager: Boolean(body.emailNotifyManager) } : {}),
    ...(body.emailNotifyChef !== undefined ? { emailNotifyChef: Boolean(body.emailNotifyChef) } : {}),
    ...(body.emailNotifyCashier !== undefined ? { emailNotifyCashier: Boolean(body.emailNotifyCashier) } : {}),
    ...(body.emailNotifyWaiter !== undefined ? { emailNotifyWaiter: Boolean(body.emailNotifyWaiter) } : {}),
    ...(body.emailNotifyRider !== undefined ? { emailNotifyRider: Boolean(body.emailNotifyRider) } : {}),
    ...(body.emailNotifyCustomer !== undefined
      ? { emailNotifyCustomer: Boolean(body.emailNotifyCustomer) }
      : {}),
    ...(body.facebookUrl !== undefined ? { facebookUrl: String(body.facebookUrl) } : {}),
    ...(body.instagramUrl !== undefined ? { instagramUrl: String(body.instagramUrl) } : {}),
    ...(body.tiktokUrl !== undefined ? { tiktokUrl: String(body.tiktokUrl) } : {}),
    ...(body.youtubeUrl !== undefined ? { youtubeUrl: String(body.youtubeUrl) } : {}),
    ...(body.googlePlaceId !== undefined ? { googlePlaceId: String(body.googlePlaceId).trim() } : {}),
    ...(body.foodCostTargetPercent !== undefined
      ? { foodCostTargetPercent: num(body.foodCostTargetPercent) ?? 32 }
      : {}),
    ...(body.foodCostHighPercent !== undefined
      ? { foodCostHighPercent: num(body.foodCostHighPercent) ?? 40 }
      : {}),
    ...(body.suggestedPriceRoundingStep !== undefined
      ? { suggestedPriceRoundingStep: Number(body.suggestedPriceRoundingStep) || 10 }
      : {}),
    ...(body.suspiciousLowCostFraction !== undefined
      ? { suspiciousLowCostFraction: num(body.suspiciousLowCostFraction) ?? 0.25 }
      : {}),
    ...(body.ingredientPriceChangeAlertPercent !== undefined
      ? { ingredientPriceChangeAlertPercent: num(body.ingredientPriceChangeAlertPercent) ?? 10 }
      : {}),
  };
}

export function settingsWithVersion(row: StoreSettings) {
  const { settingsVersion, ...rest } = row;
  return { ...rest, version: settingsVersion };
}

export async function adminSettingsWithVersion(
  row: StoreSettings,
  lookupUserName?: (userId: string) => Promise<string | null>
) {
  const base = settingsWithVersion(row);
  if (!row.onlineClosedByUserId) return { ...base, onlineClosedByName: null };
  const name = lookupUserName
    ? await lookupUserName(row.onlineClosedByUserId)
    : null;
  return { ...base, onlineClosedByName: name };
}

export type SettingsConflictDiff = Record<string, { yours: unknown; theirs: unknown }>;

export function diffSettingsValues(
  keys: string[],
  yours: Record<string, unknown>,
  theirs: Record<string, unknown>
): SettingsConflictDiff {
  const diff: SettingsConflictDiff = {};
  for (const key of keys) {
    const a = yours[key];
    const b = theirs[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      diff[key] = { yours: a, theirs: b };
    }
  }
  return diff;
}

export async function patchStoreSettingsSection(opts: {
  sectionId: SettingsSectionId;
  body: Record<string, unknown>;
  expectedVersion: number;
}): Promise<
  | { ok: true; settings: StoreSettings }
  | { ok: false; status: 409; current: StoreSettings; diff: SettingsConflictDiff }
> {
  const patch = pickSectionPatch(opts.sectionId, opts.body);
  const patchWithLegacy =
    opts.sectionId === "alert-thresholds" ? legacySlaMirrorFromAlertThresholds(patch) : patch;
  const normalized = normalizeSettingsPatch(patchWithLegacy);
  const data = buildStoreSettingsUpdateData(normalized);
  const touchedKeys = Object.keys(normalized);

  if (touchedKeys.length === 0) {
    const current = await getStoreSettings();
    return { ok: true, settings: current };
  }

  const current = await getStoreSettings();
  if (current.settingsVersion !== opts.expectedVersion) {
    const diff = diffSettingsValues(
      touchedKeys,
      normalized,
      sectionFieldValues(opts.sectionId, current as unknown as Record<string, unknown>)
    );
    return { ok: false, status: 409, current, diff };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.storeSettings.updateMany({
      where: { id: current.id, settingsVersion: opts.expectedVersion },
      data: {
        ...data,
        settingsVersion: opts.expectedVersion + 1,
      },
    });
    if (result.count === 0) {
      return null;
    }
    return tx.storeSettings.findUniqueOrThrow({ where: { id: current.id } });
  });

  if (!updated) {
    const latest = await getStoreSettings();
    const diff = diffSettingsValues(
      touchedKeys,
      normalized,
      sectionFieldValues(opts.sectionId, latest as unknown as Record<string, unknown>)
    );
    return { ok: false, status: 409, current: latest, diff };
  }

  return { ok: true, settings: updated };
}
