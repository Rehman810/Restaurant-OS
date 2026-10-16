import { Router } from "express";
import fs from "fs";
import path from "path";
import { prisma } from "../lib/prisma";
import { canAccessOrder } from "../lib/order-access";
import { optionalAuth } from "../middleware/auth";
import { generateInvoicePdf } from "../lib/invoice";

export const invoicesRouter = Router();

invoicesRouter.get("/:orderId/download", optionalAuth, async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : null;
  const order = await prisma.order.findUnique({
    where: { id: req.params.orderId },
    include: { invoice: true },
  });
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (!(await canAccessOrder(order, req.user, token))) {
    return res.status(403).json({ error: "You do not have access to this invoice." });
  }
  if (order.status !== "DELIVERED" && !order.invoice) {
    return res.status(400).json({ error: "Invoice is available after delivery." });
  }

  const invoice = order.invoice || (await generateInvoicePdf(order.id));
  if (!fs.existsSync(invoice.pdfPath)) {
    await generateInvoicePdf(order.id);
  }
  const fresh = await prisma.invoice.findUnique({ where: { orderId: order.id } });
  if (!fresh || !fs.existsSync(fresh.pdfPath)) {
    return res.status(500).json({ error: "Could not generate invoice." });
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${path.basename(fresh.pdfPath)}"`
  );
  fs.createReadStream(fresh.pdfPath).pipe(res);
});
