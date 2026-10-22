import { PlatformInvoiceStatus, PlatformPaymentMethod, SubscriptionStatus, TenantStatus } from "@prisma/client";
import { basePrisma } from "../prisma-base";
import { withoutTenant } from "../restaurant-context";

export type RecordPlatformPaymentInput = {
  invoiceId: string;
  method: PlatformPaymentMethod;
  amountPkr: number;
  reference?: string;
  receivedAt?: Date;
  recordedBy?: string;
  notes?: string;
};

/** Manual payment entry (bank transfer, JazzCash, Easypaisa, cash, cheque). No card gateway. */
export async function recordManualPlatformPayment(input: RecordPlatformPaymentInput) {
  const receivedAt = input.receivedAt ?? new Date();
  return withoutTenant("record manual platform payment", async () => {
    const invoice = await basePrisma.platformInvoice.findUnique({
      where: { id: input.invoiceId },
      include: { subscription: true },
    });
    if (!invoice) throw Object.assign(new Error("Invoice not found."), { status: 404 });
    if (invoice.status !== PlatformInvoiceStatus.OPEN) {
      throw Object.assign(new Error("Only open invoices accept payments."), { status: 400 });
    }
    if (input.amountPkr !== invoice.amountPkr) {
      throw Object.assign(new Error("Payment amount must match the invoice total."), { status: 400 });
    }

    await basePrisma.platformPayment.create({
      data: {
        restaurantId: invoice.restaurantId,
        invoiceId: invoice.id,
        method: input.method,
        amountPkr: input.amountPkr,
        reference: input.reference?.trim() || "",
        receivedAt,
        recordedBy: input.recordedBy?.trim() || "",
        notes: input.notes?.trim() || "",
      },
    });

    await basePrisma.platformInvoice.update({
      where: { id: invoice.id },
      data: { status: PlatformInvoiceStatus.PAID, paidAt: receivedAt },
    });

    await basePrisma.subscription.update({
      where: { id: invoice.subscriptionId },
      data: { status: SubscriptionStatus.ACTIVE },
    });

    const restaurant = await basePrisma.restaurant.findUnique({
      where: { id: invoice.restaurantId },
      select: { status: true },
    });
    if (restaurant?.status === TenantStatus.PAST_DUE) {
      await basePrisma.restaurant.update({
        where: { id: invoice.restaurantId },
        data: { status: TenantStatus.ACTIVE, statusReason: "", statusChangedAt: receivedAt },
      });
    }

    return { ok: true as const, invoiceId: invoice.id };
  });
}
