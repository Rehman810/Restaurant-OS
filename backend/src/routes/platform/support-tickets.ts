import { Router } from "express";
import { SupportTicketPriority, SupportTicketStatus } from "@prisma/client";
import { basePrisma } from "../../lib/prisma-base";
import { requirePlatformAuth, requirePlatformPermission } from "../../middleware/platform-auth";
import { writePlatformAudit } from "../../lib/platform/platform-audit";
import { clientIp } from "../../lib/client-ip";

export const platformSupportTicketsRouter = Router();

platformSupportTicketsRouter.get("/", requirePlatformAuth, requirePlatformPermission("tenants:read"), async (req, res) => {
  const status = String(req.query.status || "").trim() as SupportTicketStatus | "";
  const restaurantId = String(req.query.restaurantId || "").trim();
  const tickets = await basePrisma.supportTicket.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(restaurantId ? { restaurantId } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      restaurant: { select: { id: true, slug: true, displayName: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  res.json({ tickets });
});

platformSupportTicketsRouter.post(
  "/",
  requirePlatformAuth,
  requirePlatformPermission("support:write"),
  async (req, res) => {
    const { restaurantId, subject, body, priority } = req.body as {
      restaurantId?: string;
      subject?: string;
      body?: string;
      priority?: SupportTicketPriority;
    };
    if (!restaurantId?.trim() || !subject?.trim() || !body?.trim()) {
      return res.status(400).json({ error: "Tenant, subject, and message are required." });
    }
    const ticket = await basePrisma.supportTicket.create({
      data: {
        restaurantId: restaurantId.trim(),
        subject: subject.trim(),
        priority: priority && Object.values(SupportTicketPriority).includes(priority) ? priority : "NORMAL",
        createdByEmail: req.platformUser!.email,
        messages: {
          create: {
            body: body.trim(),
            authorEmail: req.platformUser!.email,
            isOperator: true,
          },
        },
      },
      include: { messages: true },
    });
    await writePlatformAudit({
      actorId: req.platformUser!.id,
      actorEmail: req.platformUser!.email,
      action: "support_ticket.created",
      entityType: "support_ticket",
      entityId: ticket.id,
      subjectTenantId: ticket.restaurantId,
      ip: clientIp(req),
    });
    res.status(201).json({ ticket });
  }
);

platformSupportTicketsRouter.get("/:id", requirePlatformAuth, requirePlatformPermission("tenants:read"), async (req, res) => {
  const ticket = await basePrisma.supportTicket.findUnique({
    where: { id: req.params.id },
    include: {
      restaurant: { select: { id: true, slug: true, displayName: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!ticket) return res.status(404).json({ error: "Not found." });
  res.json({ ticket });
});

platformSupportTicketsRouter.post(
  "/:id/messages",
  requirePlatformAuth,
  requirePlatformPermission("support:write"),
  async (req, res) => {
    const body = String((req.body as { body?: string }).body || "").trim();
    if (!body) return res.status(400).json({ error: "Message is required." });
    const ticket = await basePrisma.supportTicket.findUnique({ where: { id: req.params.id } });
    if (!ticket) return res.status(404).json({ error: "Not found." });
    const message = await basePrisma.supportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        body,
        authorEmail: req.platformUser!.email,
        isOperator: true,
      },
    });
    await basePrisma.supportTicket.update({
      where: { id: ticket.id },
      data: { updatedAt: new Date(), status: SupportTicketStatus.PENDING },
    });
    await writePlatformAudit({
      actorId: req.platformUser!.id,
      actorEmail: req.platformUser!.email,
      action: "support_ticket.replied",
      entityType: "support_ticket",
      entityId: ticket.id,
      subjectTenantId: ticket.restaurantId,
      ip: clientIp(req),
    });
    res.status(201).json({ message });
  }
);

platformSupportTicketsRouter.patch(
  "/:id",
  requirePlatformAuth,
  requirePlatformPermission("support:write"),
  async (req, res) => {
    const { status, priority, assignedToEmail } = req.body as {
      status?: SupportTicketStatus;
      priority?: SupportTicketPriority;
      assignedToEmail?: string;
    };
    const existing = await basePrisma.supportTicket.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Not found." });
    const ticket = await basePrisma.supportTicket.update({
      where: { id: existing.id },
      data: {
        ...(status && Object.values(SupportTicketStatus).includes(status) ? { status } : {}),
        ...(priority && Object.values(SupportTicketPriority).includes(priority) ? { priority } : {}),
        ...(assignedToEmail !== undefined ? { assignedToEmail: String(assignedToEmail).trim() } : {}),
      },
    });
    await writePlatformAudit({
      actorId: req.platformUser!.id,
      actorEmail: req.platformUser!.email,
      action: "support_ticket.updated",
      entityType: "support_ticket",
      entityId: ticket.id,
      subjectTenantId: ticket.restaurantId,
      before: { status: existing.status, priority: existing.priority },
      after: { status: ticket.status, priority: ticket.priority },
      ip: clientIp(req),
    });
    res.json({ ticket });
  }
);
