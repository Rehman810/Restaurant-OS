import { Router } from "express";
import { requirePlatformAuth, requirePlatformPermission } from "../../middleware/platform-auth";
import { verifyDatabaseConnection } from "../../lib/db-health";
import { loadJobRuns } from "../../lib/platform/job-runs";
import { loadPlatformOverview } from "../../lib/platform/overview";

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
    databaseBytes: overview.databaseBytes,
    stuckOnboarding: overview.stuckOnboarding,
    atRiskCount: overview.atRiskTenants.length,
  });
});
