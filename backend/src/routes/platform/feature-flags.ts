import { Router } from "express";
import { basePrisma } from "../../lib/prisma-base";
import { requirePlatformAuth, requirePlatformPermission } from "../../middleware/platform-auth";
import { writePlatformAudit } from "../../lib/platform/platform-audit";
import { clientIp } from "../../lib/client-ip";

export const platformFeatureFlagsRouter = Router();

platformFeatureFlagsRouter.get("/", requirePlatformAuth, requirePlatformPermission("flags:read"), async (_req, res) => {
  const flags = await basePrisma.platformFeatureFlag.findMany({ orderBy: { key: "asc" } });
  res.json({ flags });
});

platformFeatureFlagsRouter.post("/", requirePlatformAuth, requirePlatformPermission("flags:write"), async (req, res) => {
  const { key, description, defaultEnabled } = req.body as {
    key?: string;
    description?: string;
    defaultEnabled?: boolean;
  };
  const normalized = String(key || "").trim().toLowerCase();
  if (!normalized) return res.status(400).json({ error: "Flag key is required." });
  try {
    const flag = await basePrisma.platformFeatureFlag.create({
      data: {
        key: normalized,
        description: String(description || "").trim(),
        defaultEnabled: Boolean(defaultEnabled),
      },
    });
    await writePlatformAudit({
      actorId: req.platformUser!.id,
      actorEmail: req.platformUser!.email,
      action: "feature_flag.created",
      entityType: "platform_feature_flag",
      entityId: flag.id,
      after: { key: flag.key },
      ip: clientIp(req),
    });
    res.status(201).json({ flag });
  } catch {
    return res.status(409).json({ error: "That flag key already exists." });
  }
});

platformFeatureFlagsRouter.patch(
  "/:id",
  requirePlatformAuth,
  requirePlatformPermission("flags:write"),
  async (req, res) => {
    const { description, defaultEnabled } = req.body as { description?: string; defaultEnabled?: boolean };
    const existing = await basePrisma.platformFeatureFlag.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Not found." });
    const flag = await basePrisma.platformFeatureFlag.update({
      where: { id: existing.id },
      data: {
        ...(description !== undefined ? { description: String(description).trim() } : {}),
        ...(defaultEnabled !== undefined ? { defaultEnabled: Boolean(defaultEnabled) } : {}),
      },
    });
    await writePlatformAudit({
      actorId: req.platformUser!.id,
      actorEmail: req.platformUser!.email,
      action: "feature_flag.updated",
      entityType: "platform_feature_flag",
      entityId: flag.id,
      ip: clientIp(req),
    });
    res.json({ flag });
  }
);

platformFeatureFlagsRouter.put(
  "/:id/tenants/:restaurantId",
  requirePlatformAuth,
  requirePlatformPermission("flags:write"),
  async (req, res) => {
    const enabled = Boolean((req.body as { enabled?: boolean }).enabled);
    const flag = await basePrisma.platformFeatureFlag.findUnique({ where: { id: req.params.id } });
    if (!flag) return res.status(404).json({ error: "Flag not found." });
    const row = await basePrisma.platformTenantFeatureFlag.upsert({
      where: { flagId_restaurantId: { flagId: flag.id, restaurantId: req.params.restaurantId } },
      create: { flagId: flag.id, restaurantId: req.params.restaurantId, enabled },
      update: { enabled },
    });
    await writePlatformAudit({
      actorId: req.platformUser!.id,
      actorEmail: req.platformUser!.email,
      action: "feature_flag.tenant_override",
      entityType: "platform_tenant_feature_flag",
      entityId: row.id,
      subjectTenantId: req.params.restaurantId,
      after: { key: flag.key, enabled },
      ip: clientIp(req),
    });
    res.json({ override: row });
  }
);
