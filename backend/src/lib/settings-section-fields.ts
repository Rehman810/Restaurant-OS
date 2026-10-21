import type { SettingsSectionId } from "./settings-sections";

/** Fields allowed per settings section (PATCH body keys, excluding `version`). */
export const SETTINGS_SECTION_FIELDS: Record<SettingsSectionId, readonly string[]> = {
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
  "banners": [],
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
    "onlineClosedAt",
    "onlineClosedByUserId",
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
    "twoFaReminderDays",
    "staffRequireTwoFaAdminManager",
    "staffInactivityDays",
    "passwordMinLength",
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

export function pickSectionPatch(
  sectionId: SettingsSectionId,
  body: Record<string, unknown>
): Record<string, unknown> {
  const allowed = new Set(SETTINGS_SECTION_FIELDS[sectionId]);
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (key === "version") continue;
    if (!allowed.has(key)) continue;
    patch[key] = value;
  }
  return patch;
}

export function sectionFieldValues(
  sectionId: SettingsSectionId,
  source: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of SETTINGS_SECTION_FIELDS[sectionId]) {
    out[key] = source[key];
  }
  return out;
}

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
