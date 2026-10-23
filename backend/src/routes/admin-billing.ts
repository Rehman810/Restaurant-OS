import { Router } from "express";
import { PlatformPaymentMethod, Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { getRestaurantId } from "../lib/restaurant-context";
import { loadTenantBillingSummary, loadTenantEntitlements } from "../lib/platform/entitlements";
import { listFeatureFlagsForTenant } from "../lib/platform/feature-flags";
import { loadTenantPaymentInstructions } from "../lib/platform/platform-settings";
import { loadSubscriptionTimelineForRestaurant } from "../lib/platform/subscription-context";
import { submitTenantPaymentProof } from "../lib/platform/payment-proofs";
import { paymentProofUpload } from "../lib/payment-proof-upload";
import { uploadPublicPath } from "../lib/uploads";
import { uploadLimiter } from "../middleware/security";

export const adminBillingRouter = Router();

/** Plan modules for sidebar gating (all staff roles). */
adminBillingRouter.get("/feature-flags", requireAuth, async (_req, res) => {
  const restaurantId = getRestaurantId();
  const flags = await listFeatureFlagsForTenant(restaurantId);
  res.json({
    flags: flags.map((f) => ({ key: f.key, description: f.description, enabled: f.enabled })),
  });
});

adminBillingRouter.get("/entitlements", requireAuth, async (_req, res) => {
  const restaurantId = getRestaurantId();
  const entitlements = await loadTenantEntitlements();
  const subCtx = await loadSubscriptionTimelineForRestaurant(restaurantId, true);
  res.json({
    entitlements,
    subscription: subCtx?.timeline ?? null,
    tenant: subCtx?.tenant ?? null,
  });
});

adminBillingRouter.get("/summary", requireAuth, requireRole(Role.ADMIN), async (_req, res) => {
  const restaurantId = getRestaurantId();
  const entitlements = await loadTenantEntitlements();
  const { subscription, openInvoice } = await loadTenantBillingSummary();
  const paymentInstructions = await loadTenantPaymentInstructions();
  const subCtx = await loadSubscriptionTimelineForRestaurant(restaurantId, true);
  if (!subscription) {
    return res.json({
      plan: null,
      subscription: null,
      openInvoice: null,
      entitlements,
      paymentInstructions,
      subscriptionTimeline: subCtx?.timeline ?? null,
      tenant: subCtx?.tenant ?? null,
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
    subscriptionTimeline: subCtx?.timeline ?? null,
    tenant: subCtx?.tenant ?? null,
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

adminBillingRouter.get("/payment-proofs", requireAuth, requireRole(Role.ADMIN), async (_req, res) => {
  const restaurantId = getRestaurantId();
  const proofs = await prisma.platformPaymentProof.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: {
      id: true,
      status: true,
      method: true,
      reference: true,
      amountPkr: true,
      paidAt: true,
      rejectReason: true,
      createdAt: true,
      invoice: { select: { invoiceNumber: true } },
    },
  });
  res.json({ proofs });
});

adminBillingRouter.post(
  "/payment-proofs",
  requireAuth,
  requireRole(Role.ADMIN),
  uploadLimiter,
  paymentProofUpload.single("receipt"),
  async (req, res) => {
    const restaurantId = getRestaurantId();
    const body = req.body as Record<string, string>;
    const invoiceId = String(body.invoiceId || "").trim();
    const method = String(body.method || "").trim() as PlatformPaymentMethod;
    const reference = String(body.reference || "").trim();
    const amountPkr = Math.round(Number(body.amountPkr));
    const paidAtRaw = String(body.paidAt || "").trim();
    if (!invoiceId || !method || !amountPkr || amountPkr < 1 || !paidAtRaw) {
      return res.status(400).json({ error: "Invoice, method, amount, and payment date are required." });
    }
    if (!Object.values(PlatformPaymentMethod).includes(method)) {
      return res.status(400).json({ error: "Invalid payment method." });
    }
    const paidAt = new Date(paidAtRaw);
    if (Number.isNaN(paidAt.getTime())) {
      return res.status(400).json({ error: "Invalid payment date." });
    }
    const receiptPath = req.file ? uploadPublicPath(req.file.filename, restaurantId) : "";
    try {
      const proof = await submitTenantPaymentProof({
        restaurantId,
        invoiceId,
        method,
        amountPkr,
        reference,
        paidAt,
        receiptPath,
        submittedBy: req.user!.email,
      });
      res.status(201).json({ proof: { id: proof.id, status: proof.status } });
    } catch (err) {
      const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 400;
      const message = err instanceof Error ? err.message : "Could not submit payment proof.";
      return res.status(status).json({ error: message });
    }
  }
);
