import { Router } from "express";
import { requirePlatformAuth, requirePlatformPermission } from "../../middleware/platform-auth";
import { loadPlatformOverview } from "../../lib/platform/overview";

export const platformOverviewRouter = Router();

platformOverviewRouter.get("/", requirePlatformAuth, requirePlatformPermission("tenants:read"), async (_req, res) => {
  res.json(await loadPlatformOverview());
});
