import { Router } from "express";
import { requirePlatformAuth, requirePlatformPermission } from "../../middleware/platform-auth";
import { loadPlatformOverview } from "../../lib/platform/overview";
import { parseOverviewRange } from "../../lib/platform/overview-analytics";

export const platformOverviewRouter = Router();

platformOverviewRouter.get("/", requirePlatformAuth, requirePlatformPermission("tenants:read"), async (req, res) => {
  const range = parseOverviewRange(String(req.query.range || ""));
  res.json(await loadPlatformOverview(range));
});
