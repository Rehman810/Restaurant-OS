import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { branchScopeError, getDefaultBranchId, resolveBranchScope } from "../lib/branch-scope";
import { getStoreSettings } from "../lib/settings-data";
import { parseDateRangeQuery } from "../lib/reports/time-range";
import { prisma } from "../lib/prisma";
import {
  buildDishCostingItems,
  buildIngredientPriceChanges,
  getDishCostingDetail,
  paginateItems,
  runCostingWhatIf,
  summarizeDishCosting,
  loadCostingContext,
} from "../lib/costing/report";
import { COST_BASIS_DESCRIPTION, csvGuardCell } from "../lib/costing/math";
import { pricesAreTaxInclusive as taxInclusive } from "../lib/tax/compute";

export const dishCostingReportRouter = Router();

const COSTING_ROLES = [Role.ADMIN, Role.MANAGER] as const;

async function resolveBranch(req: import("express").Request) {
  const scope = await resolveBranchScope(req);
  const branchId = scope.allBranches ? await getDefaultBranchId() : scope.branchId!;
  const settings = await getStoreSettings();
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true, name: true, timezone: true },
  });
  const timezone = branch?.timezone || settings.timezone || "Asia/Karachi";
  return { branchId, timezone, branchName: branch?.name ?? "Branch" };
}

function csvEscape(v: string | number | null | undefined) {
  const raw = String(v ?? "");
  const guarded = csvGuardCell(raw);
  if (/[",\n]/.test(guarded)) return `"${guarded.replace(/"/g, '""')}"`;
  return guarded;
}

function listQuery(req: import("express").Request, timezone: string) {
  const includeSales = String(req.query.include || "").includes("sales");
  const rangeDays = Number(req.query.salesDays || 30);
  const { from, to, startUtc, endUtc } = parseDateRangeQuery(
    req.query.from,
    req.query.to,
    timezone,
    Number.isFinite(rangeDays) ? rangeDays : 30
  );
  return {
    category: req.query.category ? String(req.query.category) : undefined,
    status: req.query.status ? String(req.query.status) : undefined,
    q: req.query.q ? String(req.query.q) : undefined,
    sort: req.query.sort ? String(req.query.sort) : undefined,
    order: (req.query.order === "desc" ? "desc" : "asc") as "asc" | "desc",
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 10,
    includeSales,
    salesStartUtc: includeSales ? startUtc : undefined,
    salesEndUtc: includeSales ? endUtc : undefined,
    includeCombos: req.query.includeCombos !== "false",
    salesFrom: from,
    salesTo: to,
    salesDays: rangeDays,
  };
}

async function buildListPayload(req: import("express").Request) {
  const { branchId, timezone, branchName } = await resolveBranch(req);
  const q = listQuery(req, timezone);
  const { items, settings, costAsOf } = await buildDishCostingItems(branchId, {
    branchId,
    ...q,
  });
  const { items: pageItems, total, page, pageSize } = paginateItems(items, q.page, q.pageSize);
  const summary = summarizeDishCosting(items, settings, q.salesDays);
  const store = await getStoreSettings();
  const taxMode = taxInclusive(store)
    ? "inclusive"
    : store.taxEnabled
      ? "exclusive"
      : "off";
  return {
    items: pageItems,
    summary: {
      ...summary,
      costAsOf: costAsOf.toISOString(),
    },
    meta: {
      branch: { id: branchId, name: branchName },
      timezone,
      targetFoodCostPercent: settings.foodCostTargetPercent,
      highFoodCostPercent: settings.foodCostHighPercent,
      suspiciousLowCostFraction: settings.suspiciousLowCostFraction,
      suggestedPriceRoundingStep: settings.suggestedPriceRoundingStep,
      taxMode,
      priceBasisLabel: taxInclusive(store)
        ? "Based on price before tax"
        : "Price as listed",
      salesRange: q.includeSales ? { from: q.salesFrom, to: q.salesTo } : null,
    },
    pagination: { page, pageSize, total },
  };
}

dishCostingReportRouter.get(
  "/dish-costing.csv",
  requireAuth,
  requireRole(...COSTING_ROLES),
  async (req, res) => {
    try {
      const { branchId, timezone, branchName } = await resolveBranch(req);
      const q = listQuery(req, timezone);
      const { items, settings, costAsOf } = await buildDishCostingItems(branchId, {
        branchId,
        ...q,
        page: 1,
        pageSize: 10000,
      });
      const headerRows = [
        `Branch,${csvEscape(branchName)}`,
        `Generated,${costAsOf.toISOString()}`,
        `Basis,${csvEscape(COST_BASIS_DESCRIPTION)}`,
        "",
        "name,category,type,price,netPrice,cost,marginAmount,marginPercent,foodCostPercent,band,status",
      ];
      const body = items
        .map((i) =>
          [
            csvEscape(i.name),
            csvEscape(i.category),
            i.type,
            i.price,
            i.netPrice,
            i.recipeCostDisplay ?? "",
            i.marginAmount ?? "",
            i.marginPercent ?? "",
            i.foodCostPercent ?? "",
            i.foodCostBand,
            i.status,
          ].join(",")
        )
        .join("\n");
      const bom = "\uFEFF";
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="dish-costing.csv"');
      res.send(bom + headerRows.join("\n") + "\n" + body);
    } catch (err) {
      return branchScopeError(res, err);
    }
  }
);

dishCostingReportRouter.get(
  "/ingredient-price-changes",
  requireAuth,
  requireRole(...COSTING_ROLES),
  async (req, res) => {
    try {
      const { branchId } = await resolveBranch(req);
      const settings = await getStoreSettings();
      const days = Number(req.query.days) || 30;
      const minPercent = Number(req.query.minPercent) || Number(settings.ingredientPriceChangeAlertPercent ?? 10);
      const result = await buildIngredientPriceChanges(branchId, days, minPercent);
      res.json({ branchId, days, minPercent, ...result });
    } catch (err) {
      return branchScopeError(res, err);
    }
  }
);

dishCostingReportRouter.post(
  "/dish-costing/what-if",
  requireAuth,
  requireRole(...COSTING_ROLES),
  async (req, res) => {
    try {
      const { branchId } = await resolveBranch(req);
      const body = req.body as {
        ingredientCostChanges?: { ingredientId: string; percentChange?: number; newUnitCost?: number }[];
      };
      const changes = body.ingredientCostChanges ?? [];
      const ctx = await loadCostingContext(branchId);
      const { items } = await buildDishCostingItems(branchId, { branchId, includeCombos: false });
      const impacts = await runCostingWhatIf(items, changes, ctx.settings, ctx.costByIngredient);
      res.json({ impacts });
    } catch (err) {
      return branchScopeError(res, err);
    }
  }
);

dishCostingReportRouter.get(
  "/dish-costing/:id",
  requireAuth,
  requireRole(...COSTING_ROLES),
  async (req, res) => {
    try {
      const { branchId, timezone } = await resolveBranch(req);
      const type = req.query.type === "COMBO" ? "COMBO" : "DISH";
      const detail = await getDishCostingDetail(branchId, req.params.id, type);
      if (!detail) return res.status(404).json({ error: "Not found" });
      const store = await getStoreSettings();
      res.json({
        timezone,
        priceBasisLabel: taxInclusive(store) ? "Based on price before tax" : "Price as listed",
        ...detail,
      });
    } catch (err) {
      return branchScopeError(res, err);
    }
  }
);

dishCostingReportRouter.get(
  "/dish-costing",
  requireAuth,
  requireRole(...COSTING_ROLES),
  async (req, res) => {
    try {
      res.json(await buildListPayload(req));
    } catch (err) {
      return branchScopeError(res, err);
    }
  }
);
