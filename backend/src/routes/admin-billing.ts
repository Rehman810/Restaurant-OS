import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { getRestaurantId } from "../lib/restaurant-context";
import { loadTenantBillingSummary, loadTenantEntitlements } from "../lib/platform/entitlements";
import { loadTenantPaymentInstructions } from "../lib/platform/platform-settings";

export const adminBillingRouter = Router();

adminBillingRouter.get("/summary", requireAuth, requireRole(Role.ADMIN), async (_req, res) => {
  const entitlements = await loadTenantEntitlements();
  const { subscription, openInvoice } = await loadTenantBillingSummary();
  const paymentInstructions = await loadTenantPaymentInstructions();
  if (!subscription) {
    return res.json({
      plan: null,
      subscription: null,
      openInvoice: null,
      entitlements,
    });
  }
  res.json({
    plan: subscription.plan,
    subscription: {
      status: subscription.status,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    },
    openInvoice: openInvoice
      ? {
          id: openInvoice.id,
          invoiceNumber: openInvoice.invoiceNumber,
          amountPkr: openInvoice.amountPkr,
          currency: openInvoice.currency,
          dueAt: openInvoice.dueAt,
          periodStart: openInvoice.periodStart,
          periodEnd: openInvoice.periodEnd,
        }
      : null,
    entitlements,
    paymentInstructions,
  });
});

adminBillingRouter.get("/invoices", requireAuth, requireRole(Role.ADMIN), async (_req, res) => {
  const restaurantId = getRestaurantId();
  const invoices = await prisma.platformInvoice.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "desc" },
    take: 24,
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      amountPkr: true,
      currency: true,
      periodStart: true,
      periodEnd: true,
      dueAt: true,
      paidAt: true,
    },
  });
  res.json({ invoices });
});
