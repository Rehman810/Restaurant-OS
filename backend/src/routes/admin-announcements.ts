import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { activeAnnouncementsForTenant, dismissAnnouncement } from "../lib/platform/announcements";
import { getMaintenanceState } from "../lib/platform/maintenance";

export const adminAnnouncementsRouter = Router();

adminAnnouncementsRouter.get("/", requireAuth, requireRole(Role.ADMIN, Role.MANAGER), async (_req, res) => {
  const [announcements, maintenance] = await Promise.all([
    activeAnnouncementsForTenant(),
    getMaintenanceState(),
  ]);
  res.json({ announcements, maintenance });
});

adminAnnouncementsRouter.post("/:id/dismiss", requireAuth, requireRole(Role.ADMIN, Role.MANAGER), async (req, res) => {
  await dismissAnnouncement(req.params.id);
  res.json({ ok: true });
});
