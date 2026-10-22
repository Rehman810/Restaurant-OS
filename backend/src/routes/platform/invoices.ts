import { Router } from "express";
import { PlatformPaymentMethod } from "@prisma/client";
import { basePrisma } from "../../lib/prisma-base";
import { requirePlatformAuth, requirePlatformPermission } from "../../middleware/platform-auth";
import { recordManualPlatformPayment } from "../../lib/platform/payments";
import { writePlatformAudit } from "../../lib/platform/platform-audit";
import { clientIp } from "../../lib/client-ip";

export const platformInvoicesRouter = Router();

platformInvoicesRouter.get(
  "/",
  requirePlatformAuth,
  requirePlatformPermission("billing:read"),
  async (req, res) => {
    const restaurantId = String(req.query.restaurantId || "").trim();
    const status = String(req.query.status || "").trim();
    const invoices = await basePrisma.platformInvoice.findMany({
      where: {
        ...(restaurantId ? { restaurantId } : {}),
        ...(status ? { status: status as "OPEN" | "PAID" | "VOID" | "DRAFT" } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { payments: true },
    });
    res.json({ invoices });
  }
);

platformInvoicesRouter.post(
  "/:invoiceId/payments",
  requirePlatformAuth,
  requirePlatformPermission("billing:write"),
  async (req, res) => {
    const { method, amountPkr, reference, receivedAt, notes } = req.body as {
      method?: PlatformPaymentMethod;
      amountPkr?: number;
      reference?: string;
      receivedAt?: string;
      notes?: string;
    };
    if (!method || !amountPkr || amountPkr < 1) {
      return res.status(400).json({ error: "Payment method and amount are required." });
    }
    try {
      const result = await recordManualPlatformPayment({
        invoiceId: req.params.invoiceId,
        method,
        amountPkr: Math.round(amountPkr),
        reference,
        receivedAt: receivedAt ? new Date(receivedAt) : undefined,
        recordedBy: req.platformUser!.email,
        notes,
      });
      const invoice = await basePrisma.platformInvoice.findUnique({
        where: { id: result.invoiceId },
        select: { restaurantId: true },
      });
      await writePlatformAudit({
        actorId: req.platformUser!.id,
        actorEmail: req.platformUser!.email,
        action: "platform_payment.recorded",
        entityType: "platform_invoice",
        entityId: result.invoiceId,
        subjectTenantId: invoice?.restaurantId,
        after: { method, amountPkr },
        ip: clientIp(req),
      });
      res.status(201).json(result);
    } catch (err) {
      const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 400;
      const message = err instanceof Error ? err.message : "Could not record payment.";
      return res.status(status).json({ error: message });
    }
  }
);
