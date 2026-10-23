import { Router } from "express";
import { PlatformAlertChannel } from "@prisma/client";
import { basePrisma } from "../../lib/prisma-base";
import { requirePlatformAuth, requirePlatformPermission } from "../../middleware/platform-auth";
import { writePlatformAudit } from "../../lib/platform/platform-audit";
import { clientIp } from "../../lib/client-ip";

export const platformAlertsRouter = Router();

platformAlertsRouter.get("/", requirePlatformAuth, requirePlatformPermission("security:write"), async (_req, res) => {
  const rules = await basePrisma.platformAlertRule.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ rules });
});

platformAlertsRouter.post("/", requirePlatformAuth, requirePlatformPermission("security:write"), async (req, res) => {
  const body = req.body as {
    name?: string;
    actionPattern?: string;
    channel?: PlatformAlertChannel;
    target?: string;
    enabled?: boolean;
  };
  const name = String(body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Name is required." });
  const channel =
    body.channel && Object.values(PlatformAlertChannel).includes(body.channel)
      ? body.channel
      : PlatformAlertChannel.EMAIL;
  const rule = await basePrisma.platformAlertRule.create({
    data: {
      name,
      actionPattern: String(body.actionPattern || "").trim(),
      channel,
      target: String(body.target || "").trim(),
      enabled: body.enabled !== false,
    },
  });
  await writePlatformAudit({
    actorId: req.platformUser!.id,
    actorEmail: req.platformUser!.email,
    action: "alert_rule.created",
    entityType: "platform_alert_rule",
    entityId: rule.id,
    after: { name: rule.name, channel: rule.channel },
    ip: clientIp(req),
  });
  res.status(201).json({ rule });
});

platformAlertsRouter.patch(
  "/:id",
  requirePlatformAuth,
  requirePlatformPermission("security:write"),
  async (req, res) => {
    const existing = await basePrisma.platformAlertRule.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Not found." });
    const body = req.body as Partial<{
      name: string;
      actionPattern: string;
      channel: PlatformAlertChannel;
      target: string;
      enabled: boolean;
    }>;
    const rule = await basePrisma.platformAlertRule.update({
      where: { id: existing.id },
      data: {
        ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
        ...(body.actionPattern !== undefined ? { actionPattern: String(body.actionPattern).trim() } : {}),
        ...(body.channel !== undefined ? { channel: body.channel } : {}),
        ...(body.target !== undefined ? { target: String(body.target).trim() } : {}),
        ...(body.enabled !== undefined ? { enabled: Boolean(body.enabled) } : {}),
      },
    });
    await writePlatformAudit({
      actorId: req.platformUser!.id,
      actorEmail: req.platformUser!.email,
      action: "alert_rule.updated",
      entityType: "platform_alert_rule",
      entityId: rule.id,
      ip: clientIp(req),
    });
    res.json({ rule });
  }
);
