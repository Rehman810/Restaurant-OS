import { prisma } from "../prisma";

export async function buildTaxCollectedReport(branchId: string, startUtc: Date, endUtc: Date) {
  const orders = await prisma.order.findMany({
    where: {
      branchId,
      createdAt: { gte: startUtc, lte: endUtc },
      status: { not: "CANCELLED" },
    },
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
      fulfillmentType: true,
      paymentMethod: true,
      subtotal: true,
      taxableAmount: true,
      taxAmount: true,
      total: true,
      taxRatePercentSnap: true,
      taxInclusiveSnap: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const taxTotal = orders.reduce((s, o) => s + Number(o.taxAmount), 0);
  const taxableTotal = orders.reduce((s, o) => s + Number(o.taxableAmount ?? 0), 0);

  return { orders, taxTotal, taxableTotal, orderCount: orders.length };
}

export async function buildInvoiceRegister(branchId: string, startUtc: Date, endUtc: Date) {
  const invoices = await prisma.invoice.findMany({
    where: {
      branchId,
      isCreditNote: false,
      generatedAt: { gte: startUtc, lte: endUtc },
      voidedAt: null,
    },
    include: { order: { select: { orderNumber: true, total: true, taxAmount: true } } },
    orderBy: { generatedAt: "asc" },
  });
  return invoices;
}

export async function buildCreditNoteRegister(branchId: string, startUtc: Date, endUtc: Date) {
  const notes = await prisma.invoice.findMany({
    where: {
      branchId,
      isCreditNote: true,
      generatedAt: { gte: startUtc, lte: endUtc },
    },
    include: {
      creditNoteFor: { select: { invoiceNumber: true, orderId: true } },
    },
    orderBy: { generatedAt: "asc" },
  });
  return notes;
}
