import { Router } from "express";
import { loadPlatformSettings } from "../../lib/platform/platform-settings";

export const platformStatusRouter = Router();

/** Public status (no auth) — maintenance + incidents for status page. */
platformStatusRouter.get("/public", async (_req, res) => {
  const { data } = await loadPlatformSettings();
  res.json({
    generatedAt: new Date().toISOString(),
    maintenance: data.maintenance ?? { active: false },
    statusPage: data.statusPage ?? { headline: "All systems operational", incidents: [] },
  });
});
