import { Router } from "express";
import { PlatformInvoiceStatus, PlatformPaymentMethod, Prisma } from "@prisma/client";
import { basePrisma } from "../../lib/prisma-base";
import { requirePlatformAuth, requirePlatformPermission } from "../../middleware/platform-auth";
import { recordManualPlatformPayment } from "../../lib/platform/payments";
import { writePlatformAudit } from "../../lib/platform/platform-audit";
import { clientIp } from "../../lib/client-ip";
import { voidPlatformInvoice } from "../../lib/platform/void-invoice";

export const platformInvoicesRouter = Router();

function parseInvoiceListQuery(req: import("express").Request) {
  const restaurantId = String(req.query.restaurantId || "").trim();
  const status = String(req.query.status || "").trim();
  const q = String(req.query.q || "").trim().toLowerCase();
  const from = String(req.query.from || "").trim();
  const to = String(req.query.to || "").trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const skip = (page - 1) * limit;

  const where: Prisma.PlatformInvoiceWhereInput = {
    ...(restaurantId ? { restaurantId } : {}),
    ...(status ? { status: status as PlatformInvoiceStatus } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { invoiceNumber: { contains: q, mode: "insensitive" } },
            { restaurant: { displayName: { contains: q, mode: "insensitive" } } },
            { restaurant: { slug: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  return { where, page, limit, skip };
}

platformInvoicesRouter.get(
  "/export.csv",
  requirePlatformAuth,
  requirePlatformPermission("billing:read"),
  async (req, res) => {
    const { where } = parseInvoiceListQuery(req);
    const invoices = await basePrisma.platformInvoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 5000,
      include: { restaurant: { select: { slug: true, displayName: true } } },
    });
    const lines = [
      "invoice_number,tenant_slug,tenant_name,status,amount_pkr,currency,due_at,paid_at,created_at",
    ];
    for (const inv of invoices) {
      lines.push(
        [
          inv.invoiceNumber,
          inv.restaurant.slug,
          inv.restaurant.displayName.replace(/"/g, '""'),
          inv.status,
          inv.amountPkr,
          inv.currency,
          inv.dueAt.toISOString(),
          inv.paidAt?.toISOString() || "",
          inv.createdAt.toISOString(),
        ].join(",")
      );
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="platform-invoices.csv"');
    res.send(lines.join("\n"));
  }
);

platformInvoicesRouter.get(
  "/",
  requirePlatformAuth,
  requirePlatformPermission("billing:read"),
  async (req, res) => {
    const { where, page, limit, skip } = parseInvoiceListQuery(req);
    const [total, invoices] = await Promise.all([
      basePrisma.platformInvoice.count({ where }),
      basePrisma.platformInvoice.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          restaurant: { select: { id: true, slug: true, displayName: true, isTest: true } },
          payments: true,
        },
      }),
    ]);
    res.json({ invoices, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  }
);

platformInvoicesRouter.get(
  "/:invoiceId",
  requirePlatformAuth,
  requirePlatformPermission("billing:read"),
  async (req, res) => {
    const invoice = await basePrisma.platformInvoice.findUnique({
      where: { id: req.params.invoiceId },
      include: {
        payments: { orderBy: { createdAt: "asc" } },
        restaurant: { select: { id: true, slug: true, displayName: true } },
        subscription: { include: { plan: { select: { name: true, slug: true } } } },
      },
    });
    if (!invoice) return res.status(404).json({ error: "Not found." });
    res.json({ invoice });
  }
);

platformInvoicesRouter.post(
  "/:invoiceId/void",
  requirePlatformAuth,
  requirePlatformPermission("billing:write"),
  async (req, res) => {
    try {
      const before = await basePrisma.platformInvoice.findUnique({
        where: { id: req.params.invoiceId },
        select: { status: true, restaurantId: true },
      });
      const result = await voidPlatformInvoice(req.params.invoiceId);
      await writePlatformAudit({
        actorId: req.platformUser!.id,
        actorEmail: req.platformUser!.email,
        action: "platform_invoice.voided",
        entityType: "platform_invoice",
        entityId: result.invoiceId,
        subjectTenantId: result.restaurantId,
        before: { status: before?.status },
        after: { status: PlatformInvoiceStatus.VOID },
        ip: clientIp(req),
      });
      res.json(result);
    } catch (err) {
      const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 400;
      const message = err instanceof Error ? err.message : "Could not void invoice.";
      return res.status(status).json({ error: message });
    }
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
