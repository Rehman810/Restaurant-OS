import { Router } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { normalizeBlockEmail, normalizeBlockPhone } from "../lib/blocklist";
import { cleanText } from "../lib/text";
import { requireAuth, requireRole } from "../middleware/auth";
import { writeAudit } from "../lib/audit";
import { AuditAction } from "../lib/audit-actions";
import { clientIp } from "../lib/client-ip";

export const blocklistRouter = Router();

blocklistRouter.get("/", requireAuth, requireRole(Role.ADMIN), async (_req, res) => {
  const blocks = await prisma.orderBlock.findMany({ orderBy: { createdAt: "desc" } });
  res.json(blocks);
});

blocklistRouter.post("/", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const { email, phone, reason } = req.body as {
    email?: string;
    phone?: string;
    reason?: string;
  };

  const emailKey = normalizeBlockEmail(email);
  const phoneKey = normalizeBlockPhone(phone);
  const why = cleanText(reason, 200) || "";
  if (!emailKey && !phoneKey) {
    return res.status(400).json({ error: "Enter an email or phone number to block." });
  }

  if (emailKey) {
    const existing = await prisma.orderBlock.findFirst({ where: { email: emailKey } });
    if (existing) return res.status(409).json({ error: "This email is already blocked." });
  }
  if (phoneKey) {
    const existing = await prisma.orderBlock.findFirst({ where: { phone: phoneKey } });
    if (existing) return res.status(409).json({ error: "This phone number is already blocked." });
  }

  const block = await prisma.orderBlock.create({
    data: {
      email: emailKey,
      phone: phoneKey,
      reason: why,
      createdBy: req.user!.id,
    },
  });
  await writeAudit(prisma, {
    actorId: req.user!.id,
    actorRole: req.user!.role,
    action: AuditAction.CUSTOMER_BLOCKED,
    entityType: "customer",
    entityId: block.id,
    after: { email: emailKey, phone: phoneKey },
    reason: why || null,
    ip: clientIp(req),
  });
  res.status(201).json(block);
});

blocklistRouter.delete("/:id", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const existing = await prisma.orderBlock.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Block not found." });
  await prisma.orderBlock.delete({ where: { id: existing.id } });
  await writeAudit(prisma, {
    actorId: req.user!.id,
    actorRole: req.user!.role,
    action: AuditAction.CUSTOMER_UNBLOCKED,
    entityType: "customer",
    entityId: existing.id,
    before: { email: existing.email, phone: existing.phone },
    ip: clientIp(req),
  });
  res.json({ ok: true });
});
