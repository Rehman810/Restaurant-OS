import { FiscalSubmissionStatus, type Order, type Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { getStoreSettings } from "../settings-data";
import { storeNameFrom } from "../branding";
import { nextTaxInvoiceNumber } from "./invoice-number";
import { getFiscalProvider } from "../fiscal/provider";

type OrderWithItems = Order & {
  items: {
    id: string;
    nameAtOrder: string;
    quantity: number;
    priceAtOrder: Prisma.Decimal;
    lineTaxableAmount: Prisma.Decimal;
    lineTaxAmount: Prisma.Decimal;
    lineTaxRatePercent: Prisma.Decimal | null;
  }[];
};

function legalSnapshot(settings: Awaited<ReturnType<typeof getStoreSettings>>) {
  return {
    legalName: settings.taxLegalName?.trim() || storeNameFrom(settings),
    ntn: settings.taxNumber?.trim() || "",
    strn: settings.taxStrn?.trim() || "",
    address: settings.taxBusinessAddress?.trim() || settings.address?.trim() || "",
  };
}

export async function issueTaxInvoiceForOrder(orderId: string) {
  const settings = await getStoreSettings();
  if (!settings.taxEnabled) return null;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, invoice: true },
  });
  if (!order || !order.branchId) return null;
  if (order.invoice && !order.invoice.isCreditNote) return order.invoice;

  const snap = legalSnapshot(settings);
  const taxSnap = {
    orderId: order.id,
    orderNumber: order.orderNumber,
    taxAmount: Number(order.taxAmount),
    taxableAmount: Number(order.taxableAmount ?? 0),
    rate: order.taxRatePercentSnap != null ? Number(order.taxRatePercentSnap) : null,
    inclusive: order.taxInclusiveSnap,
    lines: order.items.map((i) => ({
      name: i.nameAtOrder,
      qty: i.quantity,
      taxable: Number(i.lineTaxableAmount),
      tax: Number(i.lineTaxAmount),
      rate: i.lineTaxRatePercent != null ? Number(i.lineTaxRatePercent) : null,
    })),
  };

  const submissionStatus = settings.taxEnabled
    ? FiscalSubmissionStatus.PENDING
    : FiscalSubmissionStatus.NOT_REQUIRED;

  const invoice = await prisma.$transaction(async (tx) => {
    const existing = await tx.invoice.findUnique({ where: { orderId: order.id } });
    if (existing && !existing.isCreditNote) return existing;

    const invoiceNumber = await nextTaxInvoiceNumber(
      tx as unknown as Parameters<typeof nextTaxInvoiceNumber>[0],
      order.branchId!,
      settings.taxFiscalYearEnabled
    );
    const fiscalYear = settings.taxFiscalYearEnabled
      ? Number(invoiceNumber.match(/-(\d{4})-/)?.[1] ?? 0)
      : null;

    return tx.invoice.create({
      data: {
        orderId: order.id,
        branchId: order.branchId,
        invoiceNumber,
        isCreditNote: false,
        fiscalYear,
        submissionStatus,
        legalNameSnap: snap.legalName,
        ntnSnap: snap.ntn,
        strnSnap: snap.strn,
        addressSnap: snap.address,
        taxSnapshot: taxSnap,
        pdfPath: "",
      },
    });
  });

  const provider = getFiscalProvider();
  void provider
    .submitInvoice({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      orderId: order.id,
      branchId: order.branchId,
      total: Number(order.total),
      taxAmount: Number(order.taxAmount),
    })
    .catch(() => null);

  return invoice;
}

export async function issueCreditNoteForOrder(orderId: string) {
  const settings = await getStoreSettings();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { invoice: true },
  });
  if (!order?.invoice || order.invoice.isCreditNote) return null;
  if (!order.branchId) return null;

  const original = order.invoice;
  const snap = legalSnapshot(settings);

  return prisma.$transaction(async (tx) => {
    const existingCn = await tx.invoice.findFirst({
      where: { creditNoteForInvoiceId: original.id, isCreditNote: true },
    });
    if (existingCn) return existingCn;

    const invoiceNumber = await nextTaxInvoiceNumber(
      tx as unknown as Parameters<typeof nextTaxInvoiceNumber>[0],
      order.branchId!,
      settings.taxFiscalYearEnabled
    );

    return tx.invoice.create({
      data: {
        orderId: null,
        branchId: order.branchId,
        invoiceNumber,
        isCreditNote: true,
        creditNoteForInvoiceId: original.id,
        submissionStatus: FiscalSubmissionStatus.PENDING,
        legalNameSnap: snap.legalName,
        ntnSnap: snap.ntn,
        strnSnap: snap.strn,
        addressSnap: snap.address,
        taxSnapshot: original.taxSnapshot ?? undefined,
        pdfPath: "",
      },
    });
  });
}
