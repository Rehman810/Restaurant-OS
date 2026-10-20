import { Router } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { fetchGoogleReviews } from "../lib/google-reviews";
import { getPublicStorePayload, getStoreSettings } from "../lib/settings-data";
import { validateSettingsInput } from "../lib/settings-validate";
import { requireAuth, requireRole } from "../middleware/auth";
import { diffSettingsKeys, settingsSnapshotForAudit, writeAudit } from "../lib/audit";
import { AuditAction } from "../lib/audit-actions";
import { clientIp } from "../lib/client-ip";

export const settingsRouter = Router();

settingsRouter.get("/public", async (_req, res) => {
  res.json(await getPublicStorePayload());
});

settingsRouter.get("/reviews", async (_req, res) => {
  const settings = await getStoreSettings();
  const google = await fetchGoogleReviews(settings.googlePlaceId);
  res.json(google || { rating: 0, total: 0, reviews: [], source: "fallback" });
});

settingsRouter.get("/", requireAuth, requireRole(Role.ADMIN), async (_req, res) => {
  const settings = await getStoreSettings();
  const [banners, testimonials] = await Promise.all([
    prisma.promoBanner.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    prisma.testimonial.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
  ]);
  res.json({ settings, banners, testimonials });
});

settingsRouter.patch("/", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const fieldErrors = validateSettingsInput(body);
  if (Object.keys(fieldErrors).length) {
    return res.status(400).json({ error: Object.values(fieldErrors)[0], fields: fieldErrors });
  }
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

  if (body.openHour !== undefined && hour(body.openHour) === null) {
    return res.status(400).json({ error: "Open hour must be between 0 and 23." });
  }
  if (body.closeHour !== undefined && hour(body.closeHour) === null) {
    return res.status(400).json({ error: "Close hour must be between 0 and 23." });
  }
  if (body.openMinute !== undefined && minute(body.openMinute) === null) {
    return res.status(400).json({ error: "Open minute must be between 0 and 59." });
  }
  if (body.closeMinute !== undefined && minute(body.closeMinute) === null) {
    return res.status(400).json({ error: "Close minute must be between 0 and 59." });
  }
  if (body.minimumOrder !== undefined) {
    const min = num(body.minimumOrder);
    if (min !== undefined && (!Number.isFinite(min) || min < 0)) {
      return res.status(400).json({ error: "Minimum order must be zero or greater." });
    }
  }
  if (body.freeDeliveryAbove !== undefined && body.freeDeliveryAbove !== null) {
    const free = num(body.freeDeliveryAbove);
    if (free !== undefined && (!Number.isFinite(free) || free < 0)) {
      return res.status(400).json({ error: "Free delivery threshold must be zero or greater." });
    }
  }

  const current = await getStoreSettings();
  const beforeSnap = settingsSnapshotForAudit(current as unknown as Record<string, unknown>);
  const touchedKeys = Object.keys(body);
  const settings = await prisma.$transaction(async (tx) => {
    const updated = await tx.storeSettings.update({
    where: { id: current.id },
    data: {
      ...(body.storeName !== undefined ? { storeName: String(body.storeName).trim() } : {}),
      ...(body.logoUrl !== undefined ? { logoUrl: String(body.logoUrl).trim() } : {}),
      ...(body.faviconUrl !== undefined ? { faviconUrl: String(body.faviconUrl).trim() } : {}),
      ...(body.primaryColor !== undefined ? { primaryColor: String(body.primaryColor).trim() || "#ea580c" } : {}),
      ...(body.accentColor !== undefined ? { accentColor: String(body.accentColor).trim() || "#c2410c" } : {}),
      ...(body.city !== undefined ? { city: String(body.city).trim() } : {}),
      ...(body.timezone !== undefined ? { timezone: String(body.timezone).trim() || "Asia/Karachi" } : {}),
      ...(body.currencyCode !== undefined ? { currencyCode: String(body.currencyCode).trim().toUpperCase() || "PKR" } : {}),
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
      ...(body.refundReasonOptions !== undefined
        ? { refundReasonOptions: body.refundReasonOptions as object }
        : {}),
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
      ...(body.analyticsLowMarginPercent !== undefined
        ? { analyticsLowMarginPercent: Math.min(100, Math.max(0, Math.floor(Number(body.analyticsLowMarginPercent) || 15))) }
        : {}),
      ...(body.analyticsSlowMoverDays !== undefined
        ? { analyticsSlowMoverDays: Math.max(1, Math.floor(Number(body.analyticsSlowMoverDays) || 30)) }
        : {}),
      ...(body.analyticsEmailEnabled !== undefined
        ? { analyticsEmailEnabled: Boolean(body.analyticsEmailEnabled) }
        : {}),
      ...(body.analyticsEmailFrequency !== undefined
        ? {
            analyticsEmailFrequency:
              String(body.analyticsEmailFrequency) === "daily" ? "daily" : "weekly",
          }
        : {}),
      ...(body.analyticsEmailRecipients !== undefined
        ? { analyticsEmailRecipients: String(body.analyticsEmailRecipients) }
        : {}),
      ...(body.analyticsEmailSendHour !== undefined
        ? { analyticsEmailSendHour: Math.min(23, Math.max(0, Math.floor(Number(body.analyticsEmailSendHour) || 8))) }
        : {}),
      ...(body.offlinePosEnabled !== undefined
        ? { offlinePosEnabled: Boolean(body.offlinePosEnabled) }
        : {}),
      ...(body.offlineClockSkewThresholdMinutes !== undefined
        ? { offlineClockSkewThresholdMinutes: Math.max(1, Math.floor(Number(body.offlineClockSkewThresholdMinutes) || 10)) }
        : {}),
      ...(body.storefrontPushEnabled !== undefined
        ? { storefrontPushEnabled: Boolean(body.storefrontPushEnabled) }
        : {}),
      ...(body.autoPrintKitchenTickets !== undefined
        ? { autoPrintKitchenTickets: Boolean(body.autoPrintKitchenTickets) }
        : {}),
      ...(body.loyaltyEarnPer100 !== undefined
        ? { loyaltyEarnPer100: num(body.loyaltyEarnPer100) ?? 1 }
        : {}),
      ...(body.loyaltyRedeemPerPoint !== undefined
        ? { loyaltyRedeemPerPoint: num(body.loyaltyRedeemPerPoint) ?? 1 }
        : {}),
      ...(body.loyaltyMaxRedeemPercent !== undefined
        ? { loyaltyMaxRedeemPercent: num(body.loyaltyMaxRedeemPercent) ?? 20 }
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
      ...(body.taxRatesByFulfillment !== undefined
        ? { taxRatesByFulfillment: body.taxRatesByFulfillment as object }
        : {}),
      ...(body.taxRatesByPayment !== undefined
        ? { taxRatesByPayment: body.taxRatesByPayment as object }
        : {}),
      ...(body.taxFiscalYearEnabled !== undefined
        ? { taxFiscalYearEnabled: Boolean(body.taxFiscalYearEnabled) }
        : {}),
      ...(body.taxRoundingRule !== undefined
        ? { taxRoundingRule: String(body.taxRoundingRule).trim() || "HALF_UP" }
        : {}),
      ...(body.pricesIncludeTax !== undefined
        ? { pricesIncludeTax: Boolean(body.pricesIncludeTax) }
        : {}),
      ...(body.receiptFooter !== undefined ? { receiptFooter: String(body.receiptFooter) } : {}),
      ...(body.confirmSlaMinutes !== undefined
        ? { confirmSlaMinutes: Number(body.confirmSlaMinutes) || 15 }
        : {}),
      ...(body.deliverySlaMinutes !== undefined
        ? { deliverySlaMinutes: Number(body.deliverySlaMinutes) || 45 }
        : {}),
      ...(body.autoConfirmOrders !== undefined
        ? { autoConfirmOrders: Boolean(body.autoConfirmOrders) }
        : {}),
      ...(body.autoAssignRiders !== undefined
        ? { autoAssignRiders: Boolean(body.autoAssignRiders) }
        : {}),
      ...(body.emailNotifyChef !== undefined
        ? { emailNotifyChef: Boolean(body.emailNotifyChef) }
        : {}),
      ...(body.emailNotifyCashier !== undefined
        ? { emailNotifyCashier: Boolean(body.emailNotifyCashier) }
        : {}),
      ...(body.emailNotifyRider !== undefined
        ? { emailNotifyRider: Boolean(body.emailNotifyRider) }
        : {}),
      ...(body.facebookUrl !== undefined ? { facebookUrl: String(body.facebookUrl) } : {}),
      ...(body.instagramUrl !== undefined ? { instagramUrl: String(body.instagramUrl) } : {}),
      ...(body.tiktokUrl !== undefined ? { tiktokUrl: String(body.tiktokUrl) } : {}),
      ...(body.youtubeUrl !== undefined ? { youtubeUrl: String(body.youtubeUrl) } : {}),
      ...(body.googlePlaceId !== undefined ? { googlePlaceId: String(body.googlePlaceId).trim() } : {}),
    },
  });
    const afterSnap = settingsSnapshotForAudit(updated as unknown as Record<string, unknown>);
    const { before, after } = diffSettingsKeys(beforeSnap, afterSnap, touchedKeys);
    await writeAudit(tx, {
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: AuditAction.SETTINGS_CHANGED,
      entityType: "store_settings",
      entityId: updated.id,
      before,
      after,
      ip: clientIp(req),
    });
    return updated;
  });
  res.json(settings);
});

settingsRouter.post("/banners", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const { title, imageUrl, linkUrl, sortOrder, isActive } = req.body as {
    title?: string;
    imageUrl?: string;
    linkUrl?: string;
    sortOrder?: number;
    isActive?: boolean;
  };
  if (!imageUrl) return res.status(400).json({ error: "Banner image is required." });
  const min = await prisma.promoBanner.aggregate({ _min: { sortOrder: true } });
  const banner = await prisma.promoBanner.create({
    data: {
      title: title || "",
      imageUrl,
      linkUrl: linkUrl || "",
      sortOrder: sortOrder ?? (min._min.sortOrder ?? 1) - 1,
      isActive: isActive ?? true,
    },
  });
  res.status(201).json(banner);
});

settingsRouter.patch("/banners/:id", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const existing = await prisma.promoBanner.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Banner not found." });
  const body = req.body as Record<string, unknown>;
  const banner = await prisma.promoBanner.update({
    where: { id: req.params.id },
    data: {
      ...(body.title !== undefined ? { title: String(body.title) } : {}),
      ...(body.imageUrl !== undefined ? { imageUrl: String(body.imageUrl) } : {}),
      ...(body.linkUrl !== undefined ? { linkUrl: String(body.linkUrl) } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: Number(body.sortOrder) } : {}),
      ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
    },
  });
  res.json(banner);
});

settingsRouter.delete("/banners/:id", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  try {
    await prisma.promoBanner.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Banner not found." });
  }
});

settingsRouter.post("/testimonials", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const { name, text, area, rating } = req.body as {
    name?: string;
    text?: string;
    area?: string;
    rating?: number;
  };
  if (!name?.trim() || !text?.trim()) {
    return res.status(400).json({ error: "Name and review text are required." });
  }
  const row = await prisma.testimonial.create({
    data: {
      name: name.trim(),
      text: text.trim(),
      area: area?.trim() || "",
      rating: Math.min(5, Math.max(1, Number(rating) || 5)),
    },
  });
  res.status(201).json(row);
});

settingsRouter.delete("/testimonials/:id", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  try {
    await prisma.testimonial.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Testimonial not found." });
  }
});
