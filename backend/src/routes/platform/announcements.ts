import { Router } from "express";
import { AnnouncementAudience, AnnouncementPublishStatus, AnnouncementSeverity, TenantStatus } from "@prisma/client";
import { requirePlatformAuth, requirePlatformPermission } from "../../middleware/platform-auth";
import { createPlatformAnnouncement, listPlatformAnnouncements } from "../../lib/platform/announcements";
import { deliverMaintenanceBroadcast, deliverPlatformAnnouncement } from "../../lib/platform/broadcast";
import { writePlatformAudit } from "../../lib/platform/platform-audit";
import { clientIp } from "../../lib/client-ip";
import { invalidateMaintenanceCache } from "../../lib/platform/maintenance";
import { updatePlatformSettings, loadPlatformSettings } from "../../lib/platform/platform-settings";
import { basePrisma } from "../../lib/prisma-base";

export const platformAnnouncementsRouter = Router();

platformAnnouncementsRouter.get("/", requirePlatformAuth, requirePlatformPermission("tenants:read"), async (_req, res) => {
  const announcements = await listPlatformAnnouncements();
  res.json({ announcements });
});

platformAnnouncementsRouter.post("/", requirePlatformAuth, requirePlatformPermission("tenants:write"), async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const asDraft = body.draft === true;
  const scheduledAt = body.scheduledAt ? new Date(String(body.scheduledAt)) : null;
  const startsAt = body.startsAt ? new Date(String(body.startsAt)) : new Date();
  let publishStatus: AnnouncementPublishStatus = AnnouncementPublishStatus.PUBLISHED;
  if (asDraft) publishStatus = AnnouncementPublishStatus.DRAFT;
  else if (scheduledAt && scheduledAt.getTime() > Date.now()) publishStatus = AnnouncementPublishStatus.SCHEDULED;

  const row = await createPlatformAnnouncement({
    title: String(body.title || ""),
    body: body.body ? String(body.body) : "",
    severity: (body.severity as AnnouncementSeverity) || AnnouncementSeverity.INFO,
    audience: (body.audience as AnnouncementAudience) || AnnouncementAudience.ALL,
    audiencePlanSlug: body.audiencePlanSlug ? String(body.audiencePlanSlug) : null,
    audienceStatus: body.audienceStatus ? (body.audienceStatus as TenantStatus) : null,
    audienceTenantIds: Array.isArray(body.audienceTenantIds) ? body.audienceTenantIds.map(String) : [],
    startsAt,
    endsAt: body.endsAt ? new Date(String(body.endsAt)) : null,
    dismissible: body.dismissible !== false,
    publishStatus,
    scheduledAt,
    excludeTestTenants: body.excludeTestTenants !== false,
    notifyEmail: body.notifyEmail !== false,
    notifyInApp: body.notifyInApp !== false,
  });
  await writePlatformAudit({
    actorId: req.platformUser!.id,
    actorEmail: req.platformUser!.email,
    action: "announcement.created",
    entityType: "platform_announcement",
    entityId: row.id,
    after: { title: row.title, publishStatus },
    ip: clientIp(req),
  });
  let delivery = null;
  if (publishStatus === AnnouncementPublishStatus.PUBLISHED) {
    delivery = await deliverPlatformAnnouncement(row, {
      email: body.notifyEmail !== false,
      inApp: body.notifyInApp !== false,
    });
  }
  res.status(201).json({ announcement: row, delivery });
});

platformAnnouncementsRouter.post(
  "/:id/publish",
  requirePlatformAuth,
  requirePlatformPermission("tenants:write"),
  async (req, res) => {
    const row = await basePrisma.platformAnnouncement.findUnique({ where: { id: req.params.id } });
    if (!row) return res.status(404).json({ error: "Not found." });
    if (row.publishStatus === AnnouncementPublishStatus.PUBLISHED) {
      return res.status(400).json({ error: "Already published." });
    }
    const delivery = await deliverPlatformAnnouncement(row);
    await writePlatformAudit({
      actorId: req.platformUser!.id,
      actorEmail: req.platformUser!.email,
      action: "announcement.published",
      entityType: "platform_announcement",
      entityId: row.id,
      ip: clientIp(req),
    });
    res.json({ ok: true, delivery });
  }
);

platformAnnouncementsRouter.post(
  "/maintenance",
  requirePlatformAuth,
  requirePlatformPermission("tenants:write"),
  async (req, res) => {
    const { version } = await loadPlatformSettings();
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
