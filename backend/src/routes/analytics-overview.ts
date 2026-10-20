import type { Request, Router } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { resolveBranchScope, branchScopeError, type BranchScope } from "../lib/branch-scope";
import { getStoreSettings } from "../lib/settings-data";
import { buildAnalyticsOverview, type OverviewParams } from "../lib/analytics/overview";
import { csvFromOverview } from "../lib/analytics/export";
import { runAnalyticsEmailJob } from "../lib/analytics/scheduled-email";
import { parseCompareMode, parseGranularity, parsePreset, resolvePresetRange, validateRangeDays } from "../lib/analytics/range";

async function resolveStoreTimezone(scope: { allBranches: boolean; branchId?: string | null }) {
  const settings = await getStoreSettings();
  if (!scope.allBranches && scope.branchId) {
    const branch = await prisma.branch.findUnique({
      where: { id: scope.branchId },
      select: { timezone: true },
    });
    return branch?.timezone || settings.timezone || "Asia/Karachi";
  }
  return settings.timezone || "Asia/Karachi";
}

async function paramsFromReq(req: Request, scope: BranchScope): Promise<OverviewParams> {
  const settings = await getStoreSettings();
  const timezone = await resolveStoreTimezone(scope);
  const preset = parsePreset(req.query.preset ?? req.query.period);
  const from = req.query.from ? String(req.query.from) : undefined;
  const to = req.query.to ? String(req.query.to) : undefined;
  const weekStartDay = settings.weekStartDay ?? 1;
  const resolved = resolvePresetRange(preset, timezone, new Date(), weekStartDay, from, to);
  validateRangeDays(resolved.fromKey, resolved.toKey, timezone);

  return {
    preset,
    from,
    to,
    compare: parseCompareMode(req.query.compare),
    granularity: parseGranularity(req.query.granularity),
    branchWhere: scope.where,
    timezone,
    role: req.user!.role as Role,
    weekStartDay,
    itemsPage: Number(req.query.page) || 1,
    itemsPageSize: Number(req.query.pageSize) || 20,
    itemsSort: req.query.sort ? String(req.query.sort) : undefined,
    itemsOrder: req.query.order === "asc" ? "asc" : "desc",
    itemsCategory: req.query.category ? String(req.query.category) : undefined,
    itemsQ: req.query.q ? String(req.query.q) : undefined,
    minInsightDays: settings.analyticsInsightMinDays ?? 7,
    minInsightOrders: settings.analyticsInsightMinOrders ?? 20,
  };
}

export function registerAnalyticsOverviewRoutes(
  router: Router,
  requireAuth: (typeof import("../middleware/auth"))["requireAuth"],
  requireRole: (typeof import("../middleware/auth"))["requireRole"],
  ADMIN_LIKE: Role[]
) {
  router.get("/analytics/overview", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
    let scope;
    try {
      scope = await resolveBranchScope(req);
    } catch (err) {
      return branchScopeError(res, err);
    }
    try {
      const overview = await buildAnalyticsOverview(await paramsFromReq(req, scope));
      res.setHeader("Cache-Control", "private, max-age=30");
      return res.json(overview);
    } catch (e) {
      return res.status(400).json({ error: e instanceof Error ? e.message : "Invalid range" });
    }
  });

  router.get("/analytics/export.csv", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
    let scope;
    try {
      scope = await resolveBranchScope(req);
    } catch (err) {
      return branchScopeError(res, err);
    }
    try {
      const overview = await buildAnalyticsOverview(await paramsFromReq(req, scope));
      const branchLabel = scope.allBranches ? "All branches" : scope.branchId ?? "Branch";
      const sectionRaw = req.query.section ? String(req.query.section) : "full";
      const section = ["kpis", "series", "items", "categories", "customers", "full"].includes(sectionRaw)
        ? (sectionRaw as import("../lib/analytics/export").CsvSection)
        : "full";
      const csv = csvFromOverview(overview, branchLabel, section);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="analytics-export.csv"');
      return res.send(csv);
    } catch (e) {
      return res.status(400).json({ error: e instanceof Error ? e.message : "Export failed" });
    }
  });

  router.post("/analytics/email/test", requireAuth, requireRole(Role.ADMIN), async (_req, res) => {
    try {
      await runAnalyticsEmailJob(new Date());
      return res.json({ ok: true });
    } catch (e) {
      console.error("[analytics email test]", e);
      return res.status(500).json({ error: "Failed to send test email" });
    }
  });
}
