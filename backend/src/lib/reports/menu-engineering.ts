import { OrderStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { COMPLETED_STATUSES } from "../dashboard/order-completion";
import { buildDishCostingItems } from "../costing/report";
import type { DishCostStatus } from "../costing/types";
import { roundMoney2, roundPercent1 } from "../costing/math";

export type MenuEngineeringClass = "STAR" | "PLOWHORSE" | "PUZZLE" | "DOG";

/** Kasavana–Smith popularity factor (share of units vs equal split). */
export const MENU_ENGINEERING_POPULARITY_FACTOR = 0.7;

export const MENU_ENGINEERING_MIN_CLASSIFIED_ITEMS = 8;
export const MENU_ENGINEERING_MIN_TOTAL_UNITS = 30;

export const MENU_ENGINEERING_COMPLETED_STATUSES: OrderStatus[] = COMPLETED_STATUSES;

export type MenuEngineeringThresholds = {
  popularityShareThreshold: number;
  popularitySharePercent: number;
  weightedAvgMarginPerUnit: number;
  classifiedItemCount: number;
  totalUnitsSold: number;
  hasEnoughData: boolean;
};

export function isClassifiableDish(status: DishCostStatus) {
  return status !== "NO_RECIPE";
}

export function marginPerUnitFromCosting(
  marginAmount: number | null | undefined,
  netPrice: number,
  recipeCost: number | null | undefined
): number {
  if (marginAmount != null) return marginAmount;
  if (recipeCost != null) return roundMoney2(netPrice - recipeCost);
  return 0;
}

export function computeMenuEngineeringThresholds(
  classifiedItemCount: number,
  totalUnitsSold: number,
  totalContributionMargin: number
): MenuEngineeringThresholds {
  const popularityShareThreshold =
    classifiedItemCount > 0
      ? MENU_ENGINEERING_POPULARITY_FACTOR * (1 / classifiedItemCount)
      : 0;
  const weightedAvgMarginPerUnit =
    totalUnitsSold > 0 ? totalContributionMargin / totalUnitsSold : 0;
  const hasEnoughData =
    classifiedItemCount >= MENU_ENGINEERING_MIN_CLASSIFIED_ITEMS &&
    totalUnitsSold >= MENU_ENGINEERING_MIN_TOTAL_UNITS;

  return {
    popularityShareThreshold,
    popularitySharePercent: roundPercent1(popularityShareThreshold * 100),
    weightedAvgMarginPerUnit: roundMoney2(weightedAvgMarginPerUnit),
    classifiedItemCount,
    totalUnitsSold,
    hasEnoughData,
  };
}

export function classifyMenuEngineeringItem(
  quantitySold: number,
  totalUnitsSold: number,
  marginPerUnit: number,
  thresholds: Pick<
    MenuEngineeringThresholds,
    "popularityShareThreshold" | "weightedAvgMarginPerUnit"
  >
): MenuEngineeringClass {
  const share = totalUnitsSold > 0 ? quantitySold / totalUnitsSold : 0;
  const highPop = share >= thresholds.popularityShareThreshold;
  const highMargin = marginPerUnit >= thresholds.weightedAvgMarginPerUnit;
  if (highPop && highMargin) return "STAR";
  if (highPop && !highMargin) return "PLOWHORSE";
  if (!highPop && highMargin) return "PUZZLE";
  return "DOG";
}

export type MenuEngineeringRow = {
  menuItemId: string;
  name: string;
  category: string;
  quantitySold: number;
  shareOfSalesPercent: number;
  revenue: number;
  marginPerUnit: number;
  totalProfit: number;
  foodCostPercent: number | null;
  costStatus: string;
  classification: MenuEngineeringClass | null;
  classificationLabel: string;
};

export type MenuEngineeringNoRecipeRow = {
  menuItemId: string;
  name: string;
  category: string;
  costStatus: "no_recipe";
};

export type MenuEngineeringReport = {
  rows: MenuEngineeringRow[];
  noRecipeRows: MenuEngineeringNoRecipeRow[];
  thresholds: MenuEngineeringThresholds;
  summary: {
    stars: number;
    plowhorses: number;
    puzzles: number;
    dogs: number;
    profitFromStarsPercent: number;
    totalProfit: number;
  };
  categories: string[];
};

function parseCategoryFilters(raw: unknown): string[] | undefined {
  if (raw == null || raw === "") return undefined;
  const parts = Array.isArray(raw) ? raw : String(raw).split(",");
  const cats = parts.map((p) => String(p).trim()).filter(Boolean);
  return cats.length ? cats : undefined;
}

export async function buildMenuEngineeringReport(
  branchId: string,
  startUtc: Date,
  endUtc: Date,
  categoryFilter?: string | string[]
): Promise<MenuEngineeringReport> {
  const categories = parseCategoryFilters(categoryFilter);

  const { items } = await buildDishCostingItems(branchId, {
    branchId,
    includeCombos: false,
  });

  let dishes = items.filter((i) => i.type === "DISH");
  if (categories?.length) {
    const set = new Set(categories);
    dishes = dishes.filter((d) => set.has(d.category));
  }

  const categoryList = [...new Set(dishes.map((d) => d.category))].sort();

  const sales = await prisma.orderItem.groupBy({
    by: ["menuItemId"],
    where: {
      menuItemId: { not: undefined },
      order: {
        branchId,
        status: { in: MENU_ENGINEERING_COMPLETED_STATUSES },
        createdAt: { gte: startUtc, lte: endUtc },
      },
    },
    _sum: { quantity: true },
  });

  const qtyByMenu = new Map(
    sales.map((s) => [s.menuItemId!, Number(s._sum.quantity ?? 0)])
  );

  const noRecipeRows: MenuEngineeringNoRecipeRow[] = [];
  const classifiedDraft: {
    menuItemId: string;
    name: string;
    category: string;
    quantitySold: number;
    marginPerUnit: number;
    revenue: number;
    totalProfit: number;
    foodCostPercent: number | null;
    costStatus: string;
  }[] = [];

  for (const dish of dishes) {
    if (!isClassifiableDish(dish.status)) {
      noRecipeRows.push({
        menuItemId: dish.id,
        name: dish.name,
        category: dish.category,
        costStatus: "no_recipe",
      });
      continue;
    }

    const quantitySold = qtyByMenu.get(dish.id) ?? 0;
    const marginPerUnit = marginPerUnitFromCosting(
      dish.marginAmount,
      dish.netPrice,
      dish.recipeCost
    );
    const revenue = roundMoney2(dish.netPrice * quantitySold);
    const totalProfit = roundMoney2(marginPerUnit * quantitySold);
    const costStatus =
      dish.status === "COMPLETE" || dish.status === "SUSPICIOUS_LOW"
        ? "ok"
        : dish.status === "INCOMPLETE"
          ? "partial"
          : "unknown";

    classifiedDraft.push({
      menuItemId: dish.id,
      name: dish.name,
      category: dish.category,
      quantitySold,
      marginPerUnit,
      revenue,
      totalProfit,
      foodCostPercent: dish.foodCostPercent,
      costStatus,
    });
  }

  const totalUnitsSold = classifiedDraft.reduce((s, r) => s + r.quantitySold, 0);
  const totalContributionMargin = classifiedDraft.reduce(
    (s, r) => s + r.marginPerUnit * r.quantitySold,
    0
  );
  const thresholds = computeMenuEngineeringThresholds(
    classifiedDraft.length,
    totalUnitsSold,
    totalContributionMargin
  );

  const notEnoughLabel = "Not enough data yet";

  const rows: MenuEngineeringRow[] = classifiedDraft.map((r) => {
    const shareOfSalesPercent =
      totalUnitsSold > 0 ? roundPercent1((r.quantitySold / totalUnitsSold) * 100) : 0;
    const classification = thresholds.hasEnoughData
      ? classifyMenuEngineeringItem(
          r.quantitySold,
          totalUnitsSold,
          r.marginPerUnit,
          thresholds
        )
      : null;

    return {
      menuItemId: r.menuItemId,
      name: r.name,
      category: r.category,
      quantitySold: r.quantitySold,
      shareOfSalesPercent,
      revenue: r.revenue,
      marginPerUnit: r.marginPerUnit,
      totalProfit: r.totalProfit,
      foodCostPercent: r.foodCostPercent,
      costStatus: r.costStatus,
      classification,
      classificationLabel: classification ?? notEnoughLabel,
    };
  });

  rows.sort((a, b) => b.totalProfit - a.totalProfit);

  const summary = {
    stars: 0,
    plowhorses: 0,
    puzzles: 0,
    dogs: 0,
    profitFromStarsPercent: 0,
    totalProfit: roundMoney2(rows.reduce((s, r) => s + r.totalProfit, 0)),
  };

  if (thresholds.hasEnoughData) {
    for (const r of rows) {
      if (r.classification === "STAR") summary.stars += 1;
      else if (r.classification === "PLOWHORSE") summary.plowhorses += 1;
      else if (r.classification === "PUZZLE") summary.puzzles += 1;
      else if (r.classification === "DOG") summary.dogs += 1;
    }
    const starProfit = rows
      .filter((r) => r.classification === "STAR")
      .reduce((s, r) => s + r.totalProfit, 0);
    summary.profitFromStarsPercent =
      summary.totalProfit > 0
        ? roundPercent1((starProfit / summary.totalProfit) * 100)
        : 0;
  }

  noRecipeRows.sort((a, b) => a.name.localeCompare(b.name));

  return {
    rows,
    noRecipeRows,
    thresholds,
    summary,
    categories: categoryList,
  };
}
