import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { prisma } from "./prisma";
import { getStoreSettings } from "./settings-data";
import { storeNameFrom } from "./branding";
import { formatMoney } from "./money";
import { issueTaxInvoiceForOrder } from "./tax/invoicing";

const INVOICE_DIR = path.join(__dirname, "../../invoices");

function money(n: number, settings?: { currencyCode?: string | null; currencySymbol?: string | null }) {
  return formatMoney(n, settings);
}

export async function generateInvoicePdf(orderId: string) {
  let invoiceRecord = await prisma.invoice.findUnique({ where: { orderId } });
  if (!invoiceRecord) {
    invoiceRecord = await issueTaxInvoiceForOrder(orderId);
  }
  if (invoiceRecord && invoiceRecord.pdfPath && fs.existsSync(invoiceRecord.pdfPath)) {
    return invoiceRecord;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, customer: true },
  });
  if (!order) throw new Error("Order not found");

  const settings = await getStoreSettings();
  const storeName = storeNameFrom(settings).toUpperCase();
  const legalName = (invoiceRecord?.legalNameSnap || storeName).toUpperCase();

  fs.mkdirSync(INVOICE_DIR, { recursive: true });
  const invoiceNumber =
    invoiceRecord?.invoiceNumber ?? `INV-${order.orderNumber.replace(/^[A-Z]+-/, "")}`;
  const pdfPath = path.join(INVOICE_DIR, `${invoiceNumber.replace(/[/\\]/g, "-")}.pdf`);

  const ntn = invoiceRecord?.ntnSnap || settings.taxNumber?.trim() || "";
  const strn = invoiceRecord?.strnSnap || settings.taxStrn?.trim() || "";
  const bizAddress = invoiceRecord?.addressSnap || settings.taxBusinessAddress?.trim() || settings.address;

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    doc.rect(0, 0, 595, 90).fill("#C2410C");
    doc.fillColor("#ffffff").fontSize(22).font("Helvetica-Bold").text(legalName, 48, 28);
    doc.fontSize(11).font("Helvetica").text("Tax invoice", 48, 56);

    doc.fillColor("#1c1917").fontSize(10);
    doc.text(`Invoice #: ${invoiceNumber}`, 48, 120);
    doc.text(`Order #: ${order.orderNumber}`, 48, 136);
    doc.text(`Date: ${order.createdAt.toLocaleDateString("en-PK")}`, 48, 152);
    if (bizAddress) doc.text(bizAddress, 48, 168, { width: 240 });

    doc.font("Helvetica-Bold").text("Bill to", 340, 120);
    doc.font("Helvetica").text(order.customerName, 340, 136);
    doc.text(order.customerPhone, 340, 152);
    doc.text(order.fulfillmentType === "PICKUP" ? "Takeaway" : "Delivery", 340, 168);
    doc.text(order.deliveryAddress, 340, 184, { width: 200 });

    let y = 250;
    doc.rect(48, y, 500, 24).fill("#FFF7ED");
    doc.fillColor("#9A3412").font("Helvetica-Bold").fontSize(10);
    doc.text("Item", 56, y + 7);
    doc.text("Qty", 300, y + 7);
    doc.text("Taxable", 340, y + 7);
    doc.text("Tax", 420, y + 7);
    doc.text("Amount", 480, y + 7);

    y += 32;
    doc.fillColor("#1c1917").font("Helvetica");
    for (const item of order.items) {
      const amount = Number(item.priceAtOrder) * item.quantity;
      const lineTax = Number(item.lineTaxAmount ?? 0);
      const lineTaxable = Number(item.lineTaxableAmount ?? amount);
      doc.text(item.nameAtOrder, 56, y, { width: 230 });
      doc.text(String(item.quantity), 300, y);
      doc.text(money(lineTaxable, settings), 340, y);
      doc.text(money(lineTax, settings), 420, y);
      doc.text(money(amount, settings), 480, y);
      y += 22;
    }

    y += 12;
    doc.moveTo(48, y).lineTo(548, y).strokeColor("#FED7AA").stroke();
    y += 16;
    doc.font("Helvetica").fontSize(10).fillColor("#1c1917");
    doc.text("Subtotal", 400, y);
    doc.text(money(Number(order.subtotal), settings), 480, y);
    y += 18;
    if (Number(order.deliveryCharge) > 0) {
      doc.text("Delivery", 400, y);
      doc.text(money(Number(order.deliveryCharge), settings), 480, y);
      y += 18;
    }
    if (order.taxableAmount != null && Number(order.taxableAmount) > 0) {
      doc.text("Taxable amount", 400, y);
      doc.text(money(Number(order.taxableAmount), settings), 480, y);
      y += 18;
    }
    doc.font("Helvetica").fontSize(9).fillColor("#78716c");
    if (Number(order.taxAmount) > 0) {
      const rate =
        order.taxRatePercentSnap != null ? ` (${Number(order.taxRatePercentSnap)}%)` : "";
      doc.text(`${settings.taxLabel || "Tax"}${rate}`, 400, y);
      doc.text(money(Number(order.taxAmount), settings), 480, y);
      y += 18;
    }
    if (Number(order.serviceAmount) > 0) {
      doc.text(settings.serviceChargeLabel || "Service", 400, y);
      doc.text(money(Number(order.serviceAmount), settings), 480, y);
      y += 18;
    }
    doc.font("Helvetica-Bold").fontSize(13).fillColor("#C2410C");
    doc.text("Total", 400, y);
    doc.text(money(Number(order.total), settings), 480, y);

    y += 48;
    doc.font("Helvetica").fontSize(9).fillColor("#78716c");
    const pay = order.paymentMethod === "CARD" ? "Card" : order.paymentMethod === "CASH" ? "Cash" : "Cash on delivery";
    doc.text(`Payment: ${pay}`, 48, y);
    if (ntn) doc.text(`NTN: ${ntn}`, 48, y + 14);
    if (strn) doc.text(`STRN: ${strn}`, 48, y + (ntn ? 28 : 14));
    const footer =
      settings.receiptFooter.trim() ||
      settings.footerText.trim() ||
      `Thank you for ordering from ${storeNameFrom(settings)}.`;
    doc.text(footer, 48, y + (ntn || strn ? 42 : 14), { width: 500 });

    doc.end();
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });

  if (invoiceRecord) {
    return prisma.invoice.update({
      where: { id: invoiceRecord.id },
      data: { pdfPath },
    });
  }

  return prisma.invoice.upsert({
    where: { orderId },
    update: { pdfPath, invoiceNumber },
    create: { orderId, pdfPath, invoiceNumber },
  });
}
