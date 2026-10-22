import { Router } from "express";
import { AnnouncementAudience, AnnouncementSeverity, TenantStatus } from "@prisma/client";
import { requirePlatformAuth, requirePlatformPermission } from "../../middleware/platform-auth";
import { createPlatformAnnouncement, listPlatformAnnouncements } from "../../lib/platform/announcements";
import { deliverMaintenanceBroadcast, deliverPlatformAnnouncement } from "../../lib/platform/broadcast";
import { writePlatformAudit } from "../../lib/platform/platform-audit";
import { clientIp } from "../../lib/client-ip";
import { invalidateMaintenanceCache } from "../../lib/platform/maintenance";
import { updatePlatformSettings, loadPlatformSettings } from "../../lib/platform/platform-settings";

export const platformAnnouncementsRouter = Router();

platformAnnouncementsRouter.get("/", requirePlatformAuth, requirePlatformPermission("tenants:read"), async (_req, res) => {
  const announcements = await listPlatformAnnouncements();
  res.json({ announcements });
});

platformAnnouncementsRouter.post("/", requirePlatformAuth, requirePlatformPermission("tenants:write"), async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const row = await createPlatformAnnouncement({
    title: String(body.title || ""),
    body: body.body ? String(body.body) : "",
    severity: (body.severity as AnnouncementSeverity) || AnnouncementSeverity.INFO,
    audience: (body.audience as AnnouncementAudience) || AnnouncementAudience.ALL,
    audiencePlanSlug: body.audiencePlanSlug ? String(body.audiencePlanSlug) : null,
    audienceStatus: body.audienceStatus ? (body.audienceStatus as TenantStatus) : null,
    audienceTenantIds: Array.isArray(body.audienceTenantIds) ? body.audienceTenantIds.map(String) : [],
    startsAt: body.startsAt ? new Date(String(body.startsAt)) : new Date(),
    endsAt: body.endsAt ? new Date(String(body.endsAt)) : null,
    dismissible: body.dismissible !== false,
  });
  await writePlatformAudit({
    actorId: req.platformUser!.id,
    actorEmail: req.platformUser!.email,
    action: "announcement.created",
    entityType: "platform_announcement",
    entityId: row.id,
    after: { title: row.title },
    ip: clientIp(req),
  });
  const delivery = await deliverPlatformAnnouncement(row, {
    email: body.notifyEmail !== false,
    inApp: body.notifyInApp !== false,
  });
  res.status(201).json({ announcement: row, delivery });
});

platformAnnouncementsRouter.post(
  "/maintenance",
  requirePlatformAuth,
  requirePlatformPermission("tenants:write"),
  async (req, res) => {
    const { version, data } = await loadPlatformSettings();
    const body = req.body as Record<string, unknown>;
    const maintenance = {
      active: Boolean(body.active),
      message: body.message ? String(body.message) : undefined,
      startsAt: body.startsAt ? String(body.startsAt) : undefined,
      endsAt: body.endsAt ? String(body.endsAt) : undefined,
    };
    const updated = await updatePlatformSettings(version, { maintenance });
    invalidateMaintenanceCache();
    const delivery = maintenance.active
      ? await deliverMaintenanceBroadcast(maintenance.message || "", true)
      : { tenantCount: 0 };
    await writePlatformAudit({
      actorId: req.platformUser!.id,
      actorEmail: req.platformUser!.email,
      action: "maintenance.updated",
      entityType: "platform_settings",
      entityId: "default",
      after: maintenance,
      ip: clientIp(req),
    });
    res.json({ ...updated, delivery });
  }
);
