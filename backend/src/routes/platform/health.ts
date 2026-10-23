import { Router } from "express";
import { PlatformRole } from "@prisma/client";
import { requirePlatformAuth, requirePlatformPermission } from "../../middleware/platform-auth";
import { verifyDatabaseConnection } from "../../lib/db-health";
import { loadJobRunHistory, loadJobRuns } from "../../lib/platform/job-runs";
import { loadPlatformOverview } from "../../lib/platform/overview";
import { PLATFORM_JOB_KEYS, runPlatformJobByKey, type PlatformJobKey } from "../../lib/platform/platform-jobs";
import { writePlatformAudit } from "../../lib/platform/platform-audit";
import { clientIp } from "../../lib/client-ip";

export const platformHealthRouter = Router();

platformHealthRouter.get("/", requirePlatformAuth, requirePlatformPermission("tenants:read"), async (_req, res) => {
  const [db, schedulers, overview] = await Promise.all([
    verifyDatabaseConnection(),
    loadJobRuns(),
    loadPlatformOverview(),
  ]);
  res.json({
    database: db,
    schedulers,
    jobKeys: PLATFORM_JOB_KEYS,
    databaseBytes: overview.databaseBytes,
    stuckOnboarding: overview.stuckOnboarding,
    atRiskCount: overview.atRiskTenants.length,
  });
});

platformHealthRouter.get(
  "/jobs/history",
  requirePlatformAuth,
  requirePlatformPermission("tenants:read"),
  async (req, res) => {
    const jobKey = String(req.query.jobKey || "").trim();
    const limit = Number(req.query.limit) || 25;
    const history = await loadJobRunHistory(jobKey || undefined, limit);
    res.json({ history });
  }
);

platformHealthRouter.post(
  "/jobs/:jobKey/run",
  requirePlatformAuth,
  requirePlatformPermission("tenants:write"),
  async (req, res) => {
    const role = req.platformUser!.role;
    if (role !== PlatformRole.SUPER_ADMIN && role !== PlatformRole.ADMIN) {
      return res.status(403).json({ error: "Only admins can run jobs manually." });
    }
    const jobKey = req.params.jobKey as PlatformJobKey;
    if (!PLATFORM_JOB_KEYS.includes(jobKey)) {
      return res.status(400).json({ error: "Unknown job key." });
    }
    const triggeredBy = req.platformUser!.email;
    try {
      const result = await runPlatformJobByKey(jobKey, triggeredBy);
      await writePlatformAudit({
        actorId: req.platformUser!.id,
        actorEmail: triggeredBy,
        action: "platform_job.run",
        entityType: "platform_job",
        entityId: jobKey,
        after: { result },
        ip: clientIp(req),
      });
      res.json({ ok: true, result });
    } catch (err) {
      const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 500;
      const message = err instanceof Error ? err.message : "Job failed.";
      return res.status(status).json({ error: message });
    }
  }
);
