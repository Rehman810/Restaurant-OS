import type { SettingsSectionId } from "./ia";
import type { StoreSettings } from "@/lib/types";

/** Mirrors backend SETTINGS_SECTION_FIELDS */
export const SETTINGS_SECTION_FIELD_KEYS: Record<SettingsSectionId, readonly string[]> = {
  "branding-theme": [
    "storeName",
    "storeTagline",
    "logoUrl",
    "faviconUrl",
    "primaryColor",
    "accentColor",
    "city",
    "timezone",
    "currencyCode",
    "currencySymbol",
    "footerText",
  ],
  "contact-social": [
    "phone",
    "whatsapp",
    "address",
    "latitude",
    "longitude",
    "facebookUrl",
    "instagramUrl",
    "tiktokUrl",
    "youtubeUrl",
  ],
  "reviews-testimonials": ["showReviewsSection", "showLiveStats"],
  integrations: ["googlePlaceId"],
  banners: [],
  "hours-availability": [
    "openHour",
    "openMinute",
    "closeHour",
    "closeMinute",
    "weeklySchedule",
    "specialHours",
    "closedMessage",
    "forceClosed",
    "onlineCloseReason",
    "onlineReopenAt",
    "lastOrderCutoffMinutes",
  ],
  "orders-delivery": [
    "minimumOrder",
    "freeDeliveryAbove",
    "deliveryEstimateMin",
    "pickupEstimateMin",
    "acceptCash",
    "acceptCard",
    "autoConfirmOrders",
    "autoAssignRiders",
  ],
  "tax-receipts": [
    "taxPercent",
    "taxLabel",
    "taxIncluded",
    "serviceChargePercent",
    "serviceChargeLabel",
    "serviceIncluded",
    "taxEnabled",
    "taxLegalName",
    "taxStrn",
    "taxBusinessAddress",
    "pricesIncludeTax",
    "taxFiscalYearEnabled",
    "taxRatesByFulfillment",
    "taxRatesByPayment",
    "taxRoundingRule",
    "taxNumber",
    "receiptFooter",
  ],
  notifications: [
    "emailNotifyAdmin",
    "emailNotifyManager",
    "emailNotifyChef",
    "emailNotifyCashier",
    "emailNotifyWaiter",
    "emailNotifyRider",
    "emailNotifyCustomer",
  ],
  "pos-controls-approvals": [
    "maxCashierDiscountPercent",
    "requireApprovalForVoid",
    "requireApprovalForRefund",
    "requireApprovalForPriceOverride",
    "voidReasonOptions",
    "discountReasonOptions",
    "refundReasonOptions",
    "shiftVarianceTolerance",
    "riderCashStaleHours",
  ],
  "devices-printing": [
    "storefrontPushEnabled",
    "offlinePosEnabled",
    "offlineClockSkewThresholdMinutes",
    "autoPrintKitchenTickets",
  ],
  inventory: ["inventoryAutoHideMenu", "inventoryAllowNegative", "inventoryDeductAtPreparing"],
  costing: [
    "foodCostTargetPercent",
    "foodCostHighPercent",
    "suggestedPriceRoundingStep",
    "suspiciousLowCostFraction",
    "ingredientPriceChangeAlertPercent",
  ],
  "alert-thresholds": [
    "lateConfirmMinutes",
    "latePrepMinutes",
    "lateDeliveryMinutes",
    "ordersStaleHours",
    "duplicateOrderWindowMinutes",
    "trackingCompletedWindowHours",
    "shiftOpenWarningHours",
    "lowRatingThreshold",
  ],
  "scheduled-reports": [
    "weekStartDay",
    "analyticsInsightMinDays",
    "analyticsInsightMinOrders",
    "analyticsEmailEnabled",
    "analyticsEmailFrequency",
    "analyticsEmailRecipients",
    "analyticsEmailSendHour",
    "dailyCloseoutEmailEnabled",
    "dailyCloseoutEmailRecipients",
    "dailyCloseoutEmailSendHour",
    "dailyCloseoutEmailSendMinute",
  ],
  "my-account": [],
};

export const STOREFRONT_SETTINGS_SECTIONS: SettingsSectionId[] = [
  "branding-theme",
  "contact-social",
  "reviews-testimonials",
  "integrations",
  "hours-availability",
  "orders-delivery",
  "tax-receipts",
  "notifications",
  "inventory",
];

export const STOREFRONT_ISR_SECONDS = 30;

export function pickSectionFromSettings(
  section: SettingsSectionId,
  settings: StoreSettings
): Record<string, unknown> {
  const keys = SETTINGS_SECTION_FIELD_KEYS[section];
  const src = settings as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    out[key] = src[key];
  }
  return out;
}

function stableStringify(value: unknown) {
  return JSON.stringify(value);
}

export function sectionDirtyKeys(
  section: SettingsSectionId,
  current: StoreSettings,
  baseline: Record<string, unknown>
): string[] {
  const keys = SETTINGS_SECTION_FIELD_KEYS[section];
  const src = current as unknown as Record<string, unknown>;
  const dirty: string[] = [];
  for (const key of keys) {
    if (stableStringify(src[key]) !== stableStringify(baseline[key])) {
      dirty.push(key);
    }
  }
  return dirty;
}

export function countSectionDirtyChanges(
  section: SettingsSectionId,
  current: StoreSettings,
  baseline: Record<string, unknown>
): number {
  return sectionDirtyKeys(section, current, baseline).length;
}
