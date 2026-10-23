import { PlatformInvoiceStatus } from "@prisma/client";
import { basePrisma } from "../prisma-base";
import { withoutTenant } from "../restaurant-context";

export async function voidPlatformInvoice(invoiceId: string) {
  return withoutTenant("void platform invoice", async () => {
    const invoice = await basePrisma.platformInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw Object.assign(new Error("Invoice not found."), { status: 404 });
    if (invoice.status !== PlatformInvoiceStatus.OPEN) {
      throw Object.assign(new Error("Only open invoices can be voided."), { status: 400 });
    }
    await basePrisma.platformInvoice.update({
      where: { id: invoice.id },
      data: { status: PlatformInvoiceStatus.VOID },
    });
    return { ok: true as const, invoiceId: invoice.id, restaurantId: invoice.restaurantId };
  });
}
