import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { activeAnnouncementsForTenant, dismissAnnouncement } from "../lib/platform/announcements";

export const adminAnnouncementsRouter = Router();

adminAnnouncementsRouter.get("/", requireAuth, requireRole(Role.ADMIN, Role.MANAGER), async (_req, res) => {
  res.json({ announcements: await activeAnnouncementsForTenant() });
});

adminAnnouncementsRouter.post("/:id/dismiss", requireAuth, requireRole(Role.ADMIN, Role.MANAGER), async (req, res) => {
  await dismissAnnouncement(req.params.id);
  res.json({ ok: true });
});
