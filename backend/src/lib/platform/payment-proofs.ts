import { PlatformInvoiceStatus, PlatformPaymentProofStatus } from "@prisma/client";
import { basePrisma } from "../prisma-base";
import { withoutTenant } from "../restaurant-context";
import { recordManualPlatformPayment, type RecordPlatformPaymentInput } from "./payments";
import { notifyTenantBillingEvent } from "./subscription-notify";

export type SubmitPaymentProofInput = {
  restaurantId: string;
  invoiceId: string;
  method: RecordPlatformPaymentInput["method"];
  amountPkr: number;
  reference: string;
  paidAt: Date;
  receiptPath?: string;
  submittedBy: string;
};

export async function submitTenantPaymentProof(input: SubmitPaymentProofInput) {
  return withoutTenant("submit payment proof", async () => {
    const invoice = await basePrisma.platformInvoice.findFirst({
      where: { id: input.invoiceId, restaurantId: input.restaurantId },
    });
    if (!invoice) throw Object.assign(new Error("Invoice not found."), { status: 404 });
    if (invoice.status !== PlatformInvoiceStatus.OPEN) {
      throw Object.assign(new Error("Only open invoices accept payment proof."), { status: 400 });
    }
    if (input.amountPkr !== invoice.amountPkr) {
      throw Object.assign(new Error("Amount must match the invoice total."), { status: 400 });
    }
    const pending = await basePrisma.platformPaymentProof.findFirst({
      where: { invoiceId: invoice.id, status: PlatformPaymentProofStatus.PENDING },
    });
    if (pending) {
      throw Object.assign(new Error("A payment proof is already pending review for this invoice."), {
        status: 409,
        code: "PROOF_PENDING",
      });
    }
    return basePrisma.platformPaymentProof.create({
      data: {
        restaurantId: input.restaurantId,
        invoiceId: invoice.id,
        method: input.method,
        amountPkr: input.amountPkr,
        reference: input.reference.trim(),
        paidAt: input.paidAt,
        receiptPath: input.receiptPath?.trim() || "",
        submittedBy: input.submittedBy.trim(),
      },
    });
  });
}

export async function approvePaymentProof(proofId: string, reviewedBy: string) {
  return withoutTenant("approve payment proof", async () => {
    const proof = await basePrisma.platformPaymentProof.findUnique({ where: { id: proofId } });
    if (!proof) throw Object.assign(new Error("Payment proof not found."), { status: 404 });
    if (proof.status !== PlatformPaymentProofStatus.PENDING) {
      throw Object.assign(new Error("This proof was already reviewed."), { status: 400 });
    }
    const result = await recordManualPlatformPayment({
      invoiceId: proof.invoiceId,
      method: proof.method,
      amountPkr: proof.amountPkr,
      reference: proof.reference,
      receivedAt: proof.paidAt,
      recordedBy: reviewedBy,
      notes: `Approved from tenant payment proof ${proof.id}`,
    });
    await basePrisma.platformPaymentProof.update({
      where: { id: proof.id },
      data: {
        status: PlatformPaymentProofStatus.APPROVED,
        reviewedBy,
        reviewedAt: new Date(),
      },
    });
    return result;
  });
}

export async function rejectPaymentProof(proofId: string, reviewedBy: string, rejectReason: string) {
  const reason = rejectReason.trim();
  if (!reason) throw Object.assign(new Error("A rejection reason is required."), { status: 400 });
  return withoutTenant("reject payment proof", async () => {
    const proof = await basePrisma.platformPaymentProof.findUnique({
      where: { id: proofId },
      include: {
        restaurant: { select: { displayName: true } },
        invoice: { select: { invoiceNumber: true } },
      },
    });
    if (!proof) throw Object.assign(new Error("Payment proof not found."), { status: 404 });
    if (proof.status !== PlatformPaymentProofStatus.PENDING) {
      throw Object.assign(new Error("This proof was already reviewed."), { status: 400 });
    }
    await basePrisma.platformPaymentProof.update({
      where: { id: proof.id },
      data: {
        status: PlatformPaymentProofStatus.REJECTED,
        reviewedBy,
        reviewedAt: new Date(),
        rejectReason: reason,
      },
    });
    await notifyTenantBillingEvent(proof.restaurantId, {
      title: "Payment proof not accepted",
      message: `Your payment proof for invoice ${proof.invoice.invoiceNumber} was not accepted. Reason: ${reason}`,
      severity: "warning",
    });
    return { ok: true as const, proofId: proof.id };
  });
}
