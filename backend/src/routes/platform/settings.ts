import { Router } from "express";
import { requirePlatformAuth, requirePlatformPermission } from "../../middleware/platform-auth";
import { loadPlatformSettings, updatePlatformSettings, type PlatformSettingsData } from "../../lib/platform/platform-settings";
import { writePlatformAudit } from "../../lib/platform/platform-audit";
import { clientIp } from "../../lib/client-ip";
import { invalidateMaintenanceCache } from "../../lib/platform/maintenance";

export const platformSettingsRouter = Router();

platformSettingsRouter.get("/", requirePlatformAuth, requirePlatformPermission("tenants:read"), async (_req, res) => {
  res.json(await loadPlatformSettings());
});

platformSettingsRouter.patch("/", requirePlatformAuth, requirePlatformPermission("tenants:write"), async (req, res) => {
  const body = req.body as { version?: number; data?: Partial<PlatformSettingsData> };
  const version = Number(body.version);
  if (!Number.isFinite(version)) {
    return res.status(400).json({ error: "Version is required." });
  }
  try {
    const updated = await updatePlatformSettings(version, body.data ?? {});
    if (body.data?.maintenance) invalidateMaintenanceCache();
    await writePlatformAudit({
      actorId: req.platformUser!.id,
      actorEmail: req.platformUser!.email,
      action: "platform_settings.updated",
      entityType: "platform_settings",
      entityId: "default",
      after: body.data ?? {},
      ip: clientIp(req),
    });
    res.json(updated);
  } catch (err) {
    const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 400;
    const code = typeof err === "object" && err && "code" in err ? String((err as { code: string }).code) : undefined;
    const message = err instanceof Error ? err.message : "Could not save settings.";
    return res.status(status).json({ error: message, code });
  }
});
