import type { Request, Response } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { branchScopeError, getDefaultBranchId, resolveBranchScope } from "../lib/branch-scope";
import { getStoreSettings } from "../lib/settings-data";
import { parseDateRangeQuery } from "../lib/reports/time-range";
import { buildDailyCloseOut, type DailySummaryCompare } from "../lib/reports/daily-close-out";
import { dailySummaryToCsv } from "../lib/reports/daily-summary-csv";

async function resolveBranch(req: Request) {
  const scope = await resolveBranchScope(req);
  const branchId = scope.allBranches ? await getDefaultBranchId() : scope.branchId!;
  const settings = await getStoreSettings();
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { timezone: true, name: true },
  });
  const timezone = branch?.timezone || settings.timezone || "Asia/Karachi";
  const branchName = branch?.name || "Branch";
  return { branchId, timezone, branchName, scope };
}

function parseCompare(raw: unknown): DailySummaryCompare {
  const v = String(raw || "yesterday").toLowerCase();
  if (v === "lastweek" || v === "last_week") return "lastWeek";
  if (v === "none") return "none";
  return "yesterday";
}

export async function handleDailySummaryGet(req: Request, res: Response) {
  try {
    const { branchId, timezone, branchName } = await resolveBranch(req);
    const date = req.query.date ? String(req.query.date) : undefined;
    const { from, startUtc, endUtc } = parseDateRangeQuery(date, date, timezone, 1);
    const compare = parseCompare(req.query.compare);

    const payload = await buildDailyCloseOut({
      branchId,
      branchName,
      dateKey: from,
      timezone,
      role: req.user!.role,
      compare,
    });

    if (req.query.format === "csv" || req.path.endsWith("export.csv")) {
      const csv = dailySummaryToCsv(payload);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="daily-summary-${from}.csv"`);
      return res.send(csv);
    }

    res.json({
      ...payload,
      meta: { ...payload.meta, compare },
      legacyRange: { startUtc, endUtc },
    });
  } catch (err) {
    return branchScopeError(res, err);
  }
}
