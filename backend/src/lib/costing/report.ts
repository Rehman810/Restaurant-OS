import { OrderStatus, StockMovementType } from "@prisma/client";
import { prisma } from "../prisma";
import { getStoreSettings } from "../settings-data";
import { buildDishEconomics, computeRecipeFromLines } from "./compute";
import {
  COST_BASIS_DESCRIPTION,
  costingSettingsFromStore,
  netPriceFromGross,
  roundMoney2,
  roundPercent1,
  suggestedPriceFromCost,
} from "./math";
import type { CostingItemType, CostingSettingsSlice, DishCostStatus, FoodCostBand } from "./types";

export type DishCostingListItem = {
  id: string;
  name: string;
  category: string;
  type: CostingItemType;
  price: number;
  netPrice: number;
  recipeCost: number | null;
  recipeCostDisplay: number | null;
  marginAmount: number | null;
  marginPercent: number | null;
  foodCostPercent: number | null;
  status: DishCostStatus;
  foodCostBand: FoodCostBand;
  missingIngredients: string[];
  suggestedPrice: number | null;
  priceGap: number | null;
  unitsSold?: number;
  revenue?: number;
  grossProfit?: number;
  comboComponents?: { menuItemId: string; name: string; quantity: number; recipeCost: number | null }[];
};

export type DishCostingQuery = {
  branchId: string;
  category?: string;
  status?: string;
  q?: string;
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  includeSales?: boolean;
  salesStartUtc?: Date;
  salesEndUtc?: Date;
  includeCombos?: boolean;
};

function categoryMedians(items: { category: string; recipeCostExact: number | null; status: DishCostStatus }[]) {
  const byCat = new Map<string, number[]>();
  for (const row of items) {
    if (row.status !== "COMPLETE" || row.recipeCostExact == null) continue;
    const list = byCat.get(row.category) ?? [];
    list.push(row.recipeCostExact);
    byCat.set(row.category, list);
  }
  const medians = new Map<string, number>();
  for (const [cat, costs] of byCat) {
    costs.sort((a, b) => a - b);
    medians.set(cat, costs[Math.floor(costs.length / 2)] ?? 0);
  }
  return medians;
}

async function loadIngredientCosts(branchId: string) {
  const stocks = await prisma.branchStock.findMany({
    where: { branchId },
    select: { itemId: true, avgCost: true },
  });
  return new Map(stocks.map((s) => [s.itemId, Number(s.avgCost)]));
}

export async function loadCostingContext(branchId: string) {
  const settingsRow = await getStoreSettings();
  const settings = costingSettingsFromStore(settingsRow);
  const costByIngredient = await loadIngredientCosts(branchId);
  return { settings, costByIngredient, costAsOf: new Date() };
}

export async function buildDishCostingItems(
  branchId: string,
  query: DishCostingQuery
): Promise<{ items: DishCostingListItem[]; settings: CostingSettingsSlice; costAsOf: Date }> {
  const { settings, costByIngredient, costAsOf } = await loadCostingContext(branchId);
  const includeCombos = query.includeCombos !== false;

  const menuItems = await prisma.menuItem.findMany({
    where: {
      isAvailable: true,
      ...(query.category ? { category: query.category } : {}),
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: {
      recipeLines: {
        include: { item: { select: { id: true, name: true, unit: true, defaultCost: true } } },
      },
      menuRecipe: true,
    },
  });

  const draft = menuItems.map((menu) => {
    const yieldPortions = Math.max(1, menu.menuRecipe?.yieldPortions ?? 1);
    const computed = computeRecipeFromLines(menu.recipeLines, costByIngredient, yieldPortions);
    const hasRecipe = menu.recipeLines.length > 0;
    const status: DishCostStatus = !hasRecipe
      ? "NO_RECIPE"
      : computed.missingIngredients.length
        ? "INCOMPLETE"
        : "COMPLETE";
    return {
      menu,
      yieldPortions,
      recipeCostExact: computed.recipeCostExact,
      status,
      category: menu.category,
    };
  });

  const medians = categoryMedians(
    draft.map((d) => ({
      category: d.category,
      recipeCostExact: d.recipeCostExact,
      status: d.status,
    }))
  );

  const dishItems: DishCostingListItem[] = draft.map(({ menu, yieldPortions }) => {
    const econ = buildDishEconomics(
      menu,
      menu.recipeLines,
      costByIngredient,
      yieldPortions,
      settings,
      medians.get(menu.category) ?? null
    );
    return {
      id: menu.id,
      name: menu.name,
      category: menu.category,
      type: "DISH" as const,
      price: econ.price,
      netPrice: econ.netPrice,
      recipeCost: econ.recipeCostExact,
      recipeCostDisplay: econ.recipeCostDisplay,
      marginAmount: econ.marginAmount,
      marginPercent: econ.marginPercent,
      foodCostPercent: econ.foodCostPercent,
      status: econ.status,
      foodCostBand: econ.foodCostBand,
      missingIngredients: econ.missingIngredients,
      suggestedPrice: econ.suggestedPrice,
      priceGap: econ.priceGap,
    };
  });

  let comboItems: DishCostingListItem[] = [];
  if (includeCombos) {
    const deals = await prisma.deal.findMany({
      where: { isActive: true, archivedAt: null },
      include: {
        items: { include: { menuItem: { select: { id: true, name: true, category: true } } } },
        branchAvailability: { where: { branchId } },
      },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    });
    const dishById = new Map(dishItems.map((d) => [d.id, d]));
    comboItems = deals
      .filter((deal) => {
        const avail = deal.branchAvailability[0];
        return !avail?.soldOut;
      })
      .map((deal) => {
        const components = deal.items.map((di) => {
          const dish = dishById.get(di.menuItemId);
          const unitCost = dish?.recipeCost ?? null;
          const lineCost = unitCost != null ? unitCost * di.quantity : null;
          return {
            menuItemId: di.menuItemId,
            name: di.menuItem?.name ?? "Item",
            quantity: di.quantity,
            recipeCost: lineCost != null ? roundMoney2(lineCost) : null,
          };
        });
        let recipeCost: number | null = null;
        if (components.every((c) => c.recipeCost != null)) {
          recipeCost = roundMoney2(components.reduce((s, c) => s + (c.recipeCost ?? 0), 0));
        } else if (components.some((c) => c.recipeCost != null)) {
          recipeCost = roundMoney2(
            components.reduce((s, c) => s + (c.recipeCost ?? 0), 0)
          );
        }
        const price = Number(deal.dealPrice);
        const net = netPriceFromGross(price, settings);
        const hasMissing = components.some((c) => c.recipeCost == null);
        const hasNoComponents = components.length === 0;
        let status: DishCostStatus = hasNoComponents
          ? "NO_RECIPE"
          : hasMissing
            ? "INCOMPLETE"
            : "COMPLETE";
        const canShow = status === "COMPLETE";
        const marginAmount =
          canShow && recipeCost != null ? roundMoney2(net - recipeCost) : null;
        const marginPercent =
          canShow && recipeCost != null && net > 0
            ? roundPercent1(((net - recipeCost) / net) * 100)
            : null;
        const foodCostPercent =
          canShow && recipeCost != null && net > 0
            ? roundPercent1((recipeCost / net) * 100)
            : null;
        let foodCostBand: FoodCostBand = "UNKNOWN";
        if (canShow && foodCostPercent != null) {
          if (foodCostPercent <= settings.foodCostTargetPercent) foodCostBand = "HEALTHY";
          else if (foodCostPercent <= settings.foodCostHighPercent) foodCostBand = "WATCH";
          else foodCostBand = "HIGH";
        }
        const suggestedPrice =
          recipeCost != null && canShow
            ? suggestedPriceFromCost(
                recipeCost,
                settings.foodCostTargetPercent,
                settings.suggestedPriceRoundingStep
              )
            : null;
        return {
          id: deal.id,
          name: deal.title,
          category: deal.category || "Combos",
          type: "COMBO" as const,
          price,
          netPrice: net,
          recipeCost,
          recipeCostDisplay: recipeCost,
          marginAmount,
          marginPercent,
          foodCostPercent,
          status,
          foodCostBand,
          missingIngredients: components.filter((c) => c.recipeCost == null).map((c) => c.name),
          suggestedPrice,
          priceGap: suggestedPrice != null ? roundMoney2(suggestedPrice - price) : null,
          comboComponents: components,
        };
      });
  }

  let items = [...dishItems, ...comboItems];

  const q = (query.q || "").trim().toLowerCase();
  if (q) items = items.filter((i) => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));

  const statusFilter = (query.status || "").trim().toLowerCase();
  if (statusFilter === "above_target") {
    items = items.filter(
      (i) => i.foodCostBand === "WATCH" || i.foodCostBand === "HIGH"
    );
  } else if (statusFilter === "needs_check") {
    items = items.filter(
      (i) =>
        i.status === "INCOMPLETE" ||
        i.status === "NO_RECIPE" ||
        i.status === "SUSPICIOUS_LOW"
    );
  } else if (statusFilter === "healthy") {
    items = items.filter((i) => i.foodCostBand === "HEALTHY" && i.status === "COMPLETE");
  }

  if (query.includeSales && query.salesStartUtc && query.salesEndUtc) {
    const salesLines = await prisma.orderItem.findMany({
      where: {
        order: {
          branchId,
          status: { not: OrderStatus.CANCELLED },
          createdAt: { gte: query.salesStartUtc, lte: query.salesEndUtc },
        },
      },
      select: { menuItemId: true, quantity: true, priceAtOrder: true },
    });
    const salesMap = new Map<string, { units: number; revenue: number }>();
    for (const line of salesLines) {
      const cur = salesMap.get(line.menuItemId) ?? { units: 0, revenue: 0 };
      cur.units += line.quantity;
      cur.revenue += Number(line.priceAtOrder) * line.quantity;
      salesMap.set(line.menuItemId, cur);
    }
    for (const item of items) {
      if (item.type === "COMBO") continue;
      const s = salesMap.get(item.id);
      if (!s) continue;
      item.unitsSold = s.units;
      item.revenue = roundMoney2(s.revenue);
      const unitProfit =
        item.marginAmount != null ? item.marginAmount : item.recipeCost != null && item.netPrice > 0
          ? item.netPrice - item.recipeCost
          : null;
      item.grossProfit =
        unitProfit != null ? roundMoney2(unitProfit * s.units) : undefined;
    }
  }

  const sort = query.sort || "name";
  const dir = query.order === "desc" ? -1 : 1;
  items.sort((a, b) => {
    const pick = (row: DishCostingListItem) => {
      switch (sort) {
        case "price":
          return row.price;
        case "cost":
          return row.recipeCost ?? -1;
        case "margin":
          return row.marginPercent ?? -1;
        case "food_cost":
          return row.foodCostPercent ?? -1;
        case "sold":
          return row.unitsSold ?? 0;
        case "profit":
          return row.grossProfit ?? 0;
        default:
          return row.name.toLowerCase();
      }
    };
    const av = pick(a);
    const bv = pick(b);
    if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * dir;
    return ((av as number) - (bv as number)) * dir;
  });

  return { items, settings, costAsOf };
}

export function paginateItems<T>(items: T[], page = 1, pageSize = 50) {
  const p = Math.max(1, page);
  const size = Math.min(200, Math.max(1, pageSize));
  const start = (p - 1) * size;
  return { items: items.slice(start, start + size), total: items.length, page: p, pageSize: size };
}

export function summarizeDishCosting(
  items: DishCostingListItem[],
  settings: CostingSettingsSlice,
  rangeDays = 30
) {
  const complete = items.filter((i) => i.status === "COMPLETE");
  const weighted = complete.filter((i) => i.foodCostPercent != null && (i.revenue ?? 0) > 0);
  let avgWeighted: number | null = null;
  if (weighted.length) {
    const rev = weighted.reduce((s, i) => s + (i.revenue ?? 0), 0);
    if (rev > 0) {
      avgWeighted = roundPercent1(
        weighted.reduce((s, i) => s + (i.foodCostPercent ?? 0) * (i.revenue ?? 0), 0) / rev
      );
    }
  }
  const unweighted =
    complete.length && complete.every((i) => i.foodCostPercent != null)
      ? roundPercent1(
          complete.reduce((s, i) => s + (i.foodCostPercent ?? 0), 0) / complete.length
        )
      : null;

  const bandCounts = { HEALTHY: 0, WATCH: 0, HIGH: 0, UNKNOWN: 0 };
  const statusCounts = { COMPLETE: 0, INCOMPLETE: 0, NO_RECIPE: 0, SUSPICIOUS_LOW: 0 };
  for (const i of items) {
    bandCounts[i.foodCostBand]++;
    statusCounts[i.status]++;
  }

  const days = Math.max(1, rangeDays);
  let estimatedMonthlyShortfall = 0;
  for (const i of items) {
    if (i.foodCostBand !== "WATCH" && i.foodCostBand !== "HIGH") continue;
    if (i.priceGap == null || i.priceGap <= 0 || !i.unitsSold) continue;
    const perMonth = (i.unitsSold / days) * 30;
    estimatedMonthlyShortfall += perMonth * i.priceGap;
  }

  return {
    dishCount: items.length,
    averageFoodCostPercentWeighted: avgWeighted,
    averageFoodCostPercentUnweighted: unweighted,
    bandCounts,
    statusCounts,
    estimatedMonthlyShortfall: roundMoney2(estimatedMonthlyShortfall),
    costBasis: COST_BASIS_DESCRIPTION,
  };
}

/** Back-compat shape for menu engineering */
export async function buildLegacyDishCostingRows(branchId: string, categoryFilter?: string) {
  const { items } = await buildDishCostingItems(branchId, {
    branchId,
    category: categoryFilter,
    includeCombos: false,
  });
  return items
    .filter((i) => i.type === "DISH")
    .map((i) => ({
      menuItemId: i.id,
      name: i.name,
      category: i.category,
      price: i.price,
      costStatus: i.status === "COMPLETE" || i.status === "SUSPICIOUS_LOW" ? "ok" : i.status === "INCOMPLETE" ? "partial" : "unknown",
      recipeCost: i.status === "INCOMPLETE" ? i.recipeCostDisplay : i.status === "NO_RECIPE" ? null : i.recipeCostDisplay,
      foodCostPercent: i.foodCostPercent,
      marginPercent: i.marginPercent,
      missingRecipe: i.status === "NO_RECIPE",
      missingCosts: i.missingIngredients,
    }));
}

export async function getDishCostingDetail(branchId: string, id: string, type?: CostingItemType) {
  const ctx = await loadCostingContext(branchId);
  if (type === "COMBO") {
    const deal = await prisma.deal.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            menuItem: {
              include: {
                recipeLines: {
                  include: { item: { select: { id: true, name: true, unit: true, defaultCost: true } } },
                },
                menuRecipe: true,
              },
            },
          },
        },
      },
    });
    if (deal) {
      const { items } = await buildDishCostingItems(branchId, { branchId, includeCombos: true });
      const row = items.find((i) => i.id === id && i.type === "COMBO");
      return { kind: "COMBO" as const, deal, row };
    }
  }
  const menu = await prisma.menuItem.findUnique({
    where: { id },
    include: {
      recipeLines: {
        include: { item: { select: { id: true, name: true, unit: true, defaultCost: true } } },
      },
      menuRecipe: true,
    },
  });
  if (!menu) return null;
  const { items } = await buildDishCostingItems(branchId, { branchId, includeCombos: false });
  const row = items.find((i) => i.id === id);
  const yieldPortions = Math.max(1, menu.menuRecipe?.yieldPortions ?? 1);
  const econ = buildDishEconomics(
    menu,
    menu.recipeLines,
    ctx.costByIngredient,
    yieldPortions,
    ctx.settings,
    null
  );
  const history = await ingredientCostHistory(branchId, menu.recipeLines.map((l) => l.itemId), 30);
  return { kind: "DISH" as const, menu, row, breakdown: econ.breakdown, history };
}

export async function ingredientCostHistory(branchId: string, itemIds: string[], days: number) {
  const since = new Date(Date.now() - days * 86400000);
  const movements = await prisma.stockMovement.findMany({
    where: {
      branchId,
      itemId: { in: itemIds },
      type: StockMovementType.PURCHASE,
      unitCost: { not: null },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "asc" },
    select: { itemId: true, unitCost: true, createdAt: true },
  });
  if (!movements.length) return { historyAvailable: false, points: [] as { itemId: string; at: string; unitCost: number }[] };
  return {
    historyAvailable: true,
    points: movements.map((m) => ({
      itemId: m.itemId,
      at: m.createdAt.toISOString(),
      unitCost: Number(m.unitCost),
    })),
  };
}

export async function buildIngredientPriceChanges(
  branchId: string,
  days: number,
  minPercent: number
) {
  const since = new Date(Date.now() - days * 86400000);
  const mid = new Date(Date.now() - (days / 2) * 86400000);
  const movements = await prisma.stockMovement.findMany({
    where: {
      branchId,
      type: StockMovementType.PURCHASE,
      unitCost: { not: null },
      createdAt: { gte: since },
    },
    select: { itemId: true, unitCost: true, createdAt: true, item: { select: { name: true } } },
  });
  if (!movements.length) {
    return { historyAvailable: false, changes: [] as never[] };
  }
  const byItem = new Map<string, { name: string; old: number[]; new: number[] }>();
  for (const m of movements) {
    const bucket = byItem.get(m.itemId) ?? { name: m.item.name, old: [], new: [] };
    const cost = Number(m.unitCost);
    if (m.createdAt < mid) bucket.old.push(cost);
    else bucket.new.push(cost);
    byItem.set(m.itemId, bucket);
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const recipes = await prisma.recipeLine.findMany({
    select: { itemId: true, menuItem: { select: { id: true, name: true } } },
  });
  const dishesByIngredient = new Map<string, { id: string; name: string }[]>();
  for (const line of recipes) {
    const list = dishesByIngredient.get(line.itemId) ?? [];
    list.push({ id: line.menuItem.id, name: line.menuItem.name });
    dishesByIngredient.set(line.itemId, list);
  }

  const changes = [];
  for (const [itemId, bucket] of byItem) {
    const oldAvg = avg(bucket.old);
    const newAvg = avg(bucket.new);
    if (oldAvg == null || newAvg == null || oldAvg <= 0) continue;
    const pct = ((newAvg - oldAvg) / oldAvg) * 100;
    if (Math.abs(pct) < minPercent) continue;
    changes.push({
      ingredientId: itemId,
      ingredientName: bucket.name,
      oldCost: roundMoney2(oldAvg),
      newCost: roundMoney2(newAvg),
      percentChange: roundPercent1(pct),
      affectedDishes: dishesByIngredient.get(itemId) ?? [],
    });
  }
  changes.sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange));
  return { historyAvailable: true, changes };
}

export function runCostingWhatIf(
  items: DishCostingListItem[],
  ingredientChanges: { ingredientId: string; percentChange?: number; newUnitCost?: number }[],
  settings: CostingSettingsSlice,
  costByIngredient: Map<string, number>
) {
  const adjusted = new Map(costByIngredient);
  for (const ch of ingredientChanges) {
    const cur = adjusted.get(ch.ingredientId) ?? 0;
    if (ch.newUnitCost != null) adjusted.set(ch.ingredientId, ch.newUnitCost);
    else if (ch.percentChange != null) adjusted.set(ch.ingredientId, cur * (1 + ch.percentChange / 100));
  }
  const impacts: {
    id: string;
    name: string;
    before: { recipeCost: number | null; marginPercent: number | null; band: FoodCostBand };
    after: { recipeCost: number | null; marginPercent: number | null; band: FoodCostBand };
    bandChanged: boolean;
  }[] = [];

  return prisma.menuItem
    .findMany({
      where: { isAvailable: true },
      include: {
        recipeLines: {
          include: { item: { select: { id: true, name: true, unit: true, defaultCost: true } } },
        },
        menuRecipe: true,
      },
    })
    .then((menus) => {
      for (const menu of menus) {
        const before = items.find((i) => i.id === menu.id && i.type === "DISH");
        if (!before) continue;
        const y = Math.max(1, menu.menuRecipe?.yieldPortions ?? 1);
        const afterEcon = buildDishEconomics(
          menu,
          menu.recipeLines,
          adjusted,
          y,
          settings,
          null
        );
        const bandChanged = before.foodCostBand !== afterEcon.foodCostBand;
        if (!bandChanged && before.marginPercent === afterEcon.marginPercent) continue;
        impacts.push({
          id: menu.id,
          name: menu.name,
          before: {
            recipeCost: before.recipeCostDisplay,
            marginPercent: before.marginPercent,
            band: before.foodCostBand,
          },
          after: {
            recipeCost: afterEcon.recipeCostDisplay,
            marginPercent: afterEcon.marginPercent,
            band: afterEcon.foodCostBand,
          },
          bandChanged,
        });
      }
      return impacts;
    });
}
