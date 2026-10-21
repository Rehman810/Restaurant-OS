import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { ADMIN_LIKE } from "../lib/roles";
import { branchScopeError, getDefaultBranchId, resolveBranchScope } from "../lib/branch-scope";
import { getStoreSettings } from "../lib/settings-data";
import { parseDateRangeQuery } from "../lib/reports/time-range";
import { dishCostingReportRouter } from "./dish-costing-report";
import { buildMenuEngineeringReport } from "../lib/reports/menu-engineering";
import { buildVarianceReport } from "../lib/reports/variance";
import { buildSalesIntelligence } from "../lib/reports/sales-intelligence";
import { buildDailyOwnerSummary } from "../lib/reports/daily-summary";
import {
  buildCreditNoteRegister,
  buildInvoiceRegister,
  buildTaxCollectedReport,
} from "../lib/reports/tax-register";
import { prisma } from "../lib/prisma";

export const reportsRouter = Router();

async function resolveBranch(req: import("express").Request) {
  const scope = await resolveBranchScope(req);
  const branchId = scope.allBranches ? await getDefaultBranchId() : scope.branchId!;
  const settings = await getStoreSettings();
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { timezone: true } });
  const timezone = branch?.timezone || settings.timezone || "Asia/Karachi";
  return { branchId, timezone };
}

function csvEscape(v: string | number | null | undefined) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

reportsRouter.use(dishCostingReportRouter);

reportsRouter.get(
  "/menu-engineering",
  requireAuth,
  requireRole(...ADMIN_LIKE, Role.MANAGER),
  async (req, res) => {
    try {
      const { branchId, timezone } = await resolveBranch(req);
      const { from, to, startUtc, endUtc } = parseDateRangeQuery(
        req.query.from,
        req.query.to,
        timezone,
        30
      );
      const categoryRaw =
        req.query.categories ?? req.query.category ?? undefined;
      const report = await buildMenuEngineeringReport(branchId, startUtc, endUtc, categoryRaw);
      const { rows, noRecipeRows, thresholds, summary, categories } = report;

      if (req.query.format === "csv") {
        const meta = [
          `# from,${from}`,
          `# to,${to}`,
          `# timezone,${timezone}`,
          `# popularShareMinPercent,${thresholds.popularitySharePercent}`,
          `# highMarginRsPerUnit,${thresholds.weightedAvgMarginPerUnit}`,
          `# classifiedItems,${thresholds.classifiedItemCount}`,
          `# totalUnitsSold,${thresholds.totalUnitsSold}`,
          `# enoughData,${thresholds.hasEnoughData}`,
        ].join("\n");
        const header =
          "name,category,class,qtySold,shareOfSalesPercent,revenue,marginRsPerUnit,totalProfitRs,foodCostPercent,costStatus\n";
        const body = rows
          .map((r) =>
            [
              csvEscape(r.name),
              csvEscape(r.category),
              r.classificationLabel,
              r.quantitySold,
              r.shareOfSalesPercent,
              r.revenue,
              r.marginPerUnit,
              r.totalProfit,
              r.foodCostPercent ?? "",
              r.costStatus,
            ].join(",")
          )
          .join("\n");
        const noRecipeHeader = "\n# no_recipe_items\nname,category,status\n";
        const noRecipeBody = noRecipeRows
          .map((r) => [csvEscape(r.name), csvEscape(r.category), "no_recipe"].join(","))
          .join("\n");
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="menu-engineering-${from}-${to}.csv"`);
        return res.send(meta + "\n" + header + body + noRecipeHeader + noRecipeBody);
      }

      res.json({ from, to, timezone, rows, noRecipeRows, thresholds, summary, categories });
    } catch (err) {
      return branchScopeError(res, err);
    }
  }
);

reportsRouter.get(
  "/variance",
  requireAuth,
  requireRole(...ADMIN_LIKE, Role.MANAGER),
  async (req, res) => {
    try {
      const { branchId, timezone } = await resolveBranch(req);
      const { from, to, startUtc, endUtc } = parseDateRangeQuery(
        req.query.from,
        req.query.to,
        timezone,
        14
      );
      const report = await buildVarianceReport(branchId, startUtc, endUtc);
      res.json({ from, to, ...report });
    } catch (err) {
      return branchScopeError(res, err);
    }
  }
);

reportsRouter.get(
  "/sales-intelligence",
  requireAuth,
  requireRole(...ADMIN_LIKE, Role.MANAGER),
  async (req, res) => {
    try {
      const { branchId, timezone } = await resolveBranch(req);
      const { from, to, startUtc, endUtc } = parseDateRangeQuery(
        req.query.from,
        req.query.to,
        timezone,
        14
      );
      const data = await buildSalesIntelligence(branchId, startUtc, endUtc, timezone);
      res.json({ from, to, timezone, ...data });
    } catch (err) {
      return branchScopeError(res, err);
    }
  }
);

reportsRouter.get(
  "/daily-summary",
  requireAuth,
  requireRole(...ADMIN_LIKE, Role.MANAGER),
  async (req, res) => {
    try {
      const { branchId, timezone } = await resolveBranch(req);
      const date = req.query.date ? String(req.query.date) : undefined;
      const { from, startUtc, endUtc } = parseDateRangeQuery(date, date, timezone, 1);
      const summary = await buildDailyOwnerSummary(branchId, startUtc, endUtc);

      if (req.query.format === "csv") {
        const lines = [
          "metric,value",
          `date,${from}`,
          `orders,${summary.orders}`,
          `revenue,${summary.revenue}`,
          `aov,${summary.aov}`,
          `cash,${summary.cashTotal}`,
          `card,${summary.cardTotal}`,
          `discounts,${summary.discounts}`,
          `voids,${summary.voids}`,
          `refunds,${summary.refunds}`,
          `wasteValue,${summary.wasteValue}`,
          `lowStockCount,${summary.lowStockCount}`,
        ];
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="daily-summary-${from}.csv"`);
        return res.send(lines.join("\n"));
      }

      res.json({ date: from, timezone, branchId, ...summary });
    } catch (err) {
      return branchScopeError(res, err);
    }
  }
);

reportsRouter.get(
  "/tax-collected",
  requireAuth,
  requireRole(...ADMIN_LIKE, Role.MANAGER),
  async (req, res) => {
    try {
      const { branchId, timezone } = await resolveBranch(req);
      const { from, to, startUtc, endUtc } = parseDateRangeQuery(
        req.query.from,
        req.query.to,
        timezone,
        30
      );
      const report = await buildTaxCollectedReport(branchId, startUtc, endUtc);
      if (req.query.format === "csv") {
        const header = "orderNumber,date,fulfillment,payment,subtotal,taxable,tax,total\n";
        const body = report.orders
          .map((o) =>
            [
              csvEscape(o.orderNumber),
              o.createdAt.toISOString(),
              o.fulfillmentType,
              o.paymentMethod ?? "",
              o.subtotal,
              o.taxableAmount ?? "",
              o.taxAmount,
              o.total,
            ].join(",")
          )
          .join("\n");
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="tax-collected-${from}-${to}.csv"`);
        return res.send(header + body);
      }
      res.json({ from, to, timezone, branchId, ...report });
    } catch (err) {
      return branchScopeError(res, err);
    }
  }
);

reportsRouter.get(
  "/tax-invoices",
  requireAuth,
  requireRole(...ADMIN_LIKE, Role.MANAGER),
  async (req, res) => {
    try {
      const { branchId, timezone } = await resolveBranch(req);
      const { from, to, startUtc, endUtc } = parseDateRangeQuery(
        req.query.from,
        req.query.to,
        timezone,
        30
      );
      const invoices = await buildInvoiceRegister(branchId, startUtc, endUtc);
      if (req.query.format === "csv") {
        const header = "invoiceNumber,generatedAt,orderNumber,total,tax,submissionStatus\n";
        const body = invoices
          .map((inv) =>
            [
              csvEscape(inv.invoiceNumber),
              inv.generatedAt.toISOString(),
              csvEscape(inv.order?.orderNumber ?? ""),
              inv.order?.total ?? "",
              inv.order?.taxAmount ?? "",
              inv.submissionStatus,
            ].join(",")
          )
          .join("\n");
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="tax-invoices-${from}-${to}.csv"`);
        return res.send(header + body);
      }
      res.json({ from, to, timezone, branchId, invoices });
    } catch (err) {
      return branchScopeError(res, err);
    }
  }
);

reportsRouter.get(
  "/tax-credit-notes",
  requireAuth,
  requireRole(...ADMIN_LIKE, Role.MANAGER),
  async (req, res) => {
    try {
      const { branchId, timezone } = await resolveBranch(req);
      const { from, to, startUtc, endUtc } = parseDateRangeQuery(
        req.query.from,
        req.query.to,
        timezone,
        30
      );
      const notes = await buildCreditNoteRegister(branchId, startUtc, endUtc);
      if (req.query.format === "csv") {
        const header = "creditNoteNumber,generatedAt,originalInvoice\n";
        const body = notes
          .map((n) =>
            [
              csvEscape(n.invoiceNumber),
              n.generatedAt.toISOString(),
              csvEscape(n.creditNoteFor?.invoiceNumber ?? ""),
            ].join(",")
          )
          .join("\n");
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="tax-credit-notes-${from}-${to}.csv"`
        );
        return res.send(header + body);
      }
      res.json({ from, to, timezone, branchId, creditNotes: notes });
    } catch (err) {
      return branchScopeError(res, err);
    }
  }
);
