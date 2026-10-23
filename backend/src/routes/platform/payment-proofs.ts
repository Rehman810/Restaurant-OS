import { Router } from "express";
import { PlatformPaymentProofStatus } from "@prisma/client";
import { basePrisma } from "../../lib/prisma-base";
import { requirePlatformAuth, requirePlatformPermission } from "../../middleware/platform-auth";
import { writePlatformAudit } from "../../lib/platform/platform-audit";
import { clientIp } from "../../lib/client-ip";
import { approvePaymentProof, rejectPaymentProof } from "../../lib/platform/payment-proofs";

export const platformPaymentProofsRouter = Router();

platformPaymentProofsRouter.get(
  "/",
  requirePlatformAuth,
  requirePlatformPermission("billing:read"),
  async (req, res) => {
    const status = String(req.query.status || "PENDING").trim() as PlatformPaymentProofStatus;
    const take = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const proofs = await basePrisma.platformPaymentProof.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: "desc" },
      take,
      include: {
        restaurant: { select: { id: true, displayName: true, slug: true } },
        invoice: { select: { id: true, invoiceNumber: true, amountPkr: true, status: true } },
      },
    });
    res.json({ proofs });
  }
);

platformPaymentProofsRouter.post(
  "/:id/approve",
  requirePlatformAuth,
  requirePlatformPermission("billing:write"),
  async (req, res) => {
    try {
      const result = await approvePaymentProof(req.params.id, req.platformUser!.email);
      const invoice = await basePrisma.platformInvoice.findUnique({
        where: { id: result.invoiceId },
        select: { restaurantId: true },
      });
      await writePlatformAudit({
        actorId: req.platformUser!.id,
        actorEmail: req.platformUser!.email,
        action: "payment_proof.approved",
        entityType: "platform_payment_proof",
        entityId: req.params.id,
        subjectTenantId: invoice?.restaurantId,
        after: { invoiceId: result.invoiceId },
        ip: clientIp(req),
      });
      res.json(result);
    } catch (err) {
      const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 400;
      const message = err instanceof Error ? err.message : "Could not approve proof.";
      return res.status(status).json({ error: message });
    }
  }
);

platformPaymentProofsRouter.post(
  "/:id/reject",
  requirePlatformAuth,
  requirePlatformPermission("billing:write"),
  async (req, res) => {
    const reason = String((req.body as { reason?: string }).reason || "").trim();
    try {
      const result = await rejectPaymentProof(req.params.id, req.platformUser!.email, reason);
      const proof = await basePrisma.platformPaymentProof.findUnique({
        where: { id: req.params.id },
        select: { restaurantId: true },
      });
      await writePlatformAudit({
        actorId: req.platformUser!.id,
        actorEmail: req.platformUser!.email,
        action: "payment_proof.rejected",
        entityType: "platform_payment_proof",
        entityId: req.params.id,
        subjectTenantId: proof?.restaurantId,
        after: { reason },
        ip: clientIp(req),
      });
      res.json(result);
    } catch (err) {
      const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 400;
      const message = err instanceof Error ? err.message : "Could not reject proof.";
      return res.status(status).json({ error: message });
    }
  }
);
