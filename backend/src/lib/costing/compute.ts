import type { CostingSettingsSlice, DishEconomics, IngredientCostSource, RecipeLineCost } from "./types";
import {
  computeMarginMetrics,
  classifyFoodCostBand,
  grossMenuPrice,
  netPriceFromGross,
  resolveDishStatus,
  roundMoney2,
  suggestedPriceFromCost,
} from "./math";

type RecipeLineInput = {
  itemId: string;
  quantity: { toString(): string } | number;
  item: { id: string; name: string; unit: string; defaultCost: { toString(): string } | number };
};

export function unitCostForIngredient(
  itemId: string,
  defaultCost: number,
  costByIngredient: Map<string, number>
): { unit: number | null; source: IngredientCostSource } {
  const branch = costByIngredient.get(itemId);
  if (branch != null && Number.isFinite(branch) && branch > 0) {
    return { unit: branch, source: "BRANCH_AVG" };
  }
  if (Number.isFinite(defaultCost) && defaultCost > 0) {
    return { unit: defaultCost, source: "DEFAULT" };
  }
  return { unit: null, source: "MISSING" };
}

export function computeRecipeFromLines(
  lines: RecipeLineInput[],
  costByIngredient: Map<string, number>,
  yieldPortions: number
) {
  const missing: string[] = [];
  let total = 0;
  const breakdown: RecipeLineCost[] = [];
  for (const line of lines) {
    const defaultCost = Number(line.item.defaultCost);
    const { unit, source } = unitCostForIngredient(line.itemId, defaultCost, costByIngredient);
    const qty = Number(line.quantity);
    const lineCost = unit != null ? qty * unit : null;
    if (unit == null) missing.push(line.item.name);
    else total += lineCost!;
    breakdown.push({
      ingredientId: line.item.id,
      ingredientName: line.item.name,
      quantityPerDish: qty,
      unit: line.item.unit,
      unitCost: unit != null ? roundMoney2(unit) : null,
      lineCost: lineCost != null ? roundMoney2(lineCost) : null,
      shareOfTotal: null,
      costSource: source,
    });
  }
  const portions = Math.max(1, yieldPortions);
  const exact = lines.length > 0 ? total / portions : null;
  if (exact != null && total > 0) {
    for (const row of breakdown) {
      const rawLine = row.lineCost != null ? row.lineCost * portions : 0;
      row.shareOfTotal = rawLine > 0 ? roundMoney2((rawLine / total) * 100) : null;
      row.lineCost = row.lineCost != null ? roundMoney2(row.lineCost / portions) : null;
      row.quantityPerDish = roundMoney2(qtyPerPortion(row.quantityPerDish, portions));
    }
  }
  return { recipeCostExact: exact, missingIngredients: missing, breakdown };
}

function qtyPerPortion(qty: number, portions: number) {
  return qty / portions;
}

export function buildDishEconomics(
  menu: { price: { toString(): string } | number; discountPrice?: { toString(): string } | number | null },
  lines: RecipeLineInput[],
  costByIngredient: Map<string, number>,
  yieldPortions: number,
  settings: CostingSettingsSlice,
  categoryMedianCost: number | null
): DishEconomics & { breakdown: RecipeLineCost[] } {
  const price = grossMenuPrice(menu);
  const netPrice = netPriceFromGross(price, settings);
  const hasRecipe = lines.length > 0;
  const { recipeCostExact, missingIngredients, breakdown } = computeRecipeFromLines(
    lines,
    costByIngredient,
    yieldPortions
  );
  const status = resolveDishStatus(
    hasRecipe,
    missingIngredients,
    recipeCostExact,
    categoryMedianCost,
    settings.suspiciousLowCostFraction
  );
  const canShowMargin = status === "COMPLETE" || status === "SUSPICIOUS_LOW";
  const metrics =
    recipeCostExact != null && canShowMargin
      ? computeMarginMetrics(recipeCostExact, netPrice)
      : { marginAmount: null, marginPercent: null, foodCostPercent: null };
  const foodCostBand = classifyFoodCostBand(
    canShowMargin ? metrics.foodCostPercent : null,
    status,
    settings
  );
  const suggestedPrice =
    recipeCostExact != null && canShowMargin
      ? suggestedPriceFromCost(
          recipeCostExact,
          settings.foodCostTargetPercent,
          settings.suggestedPriceRoundingStep
        )
      : null;
  const priceGap = suggestedPrice != null ? roundMoney2(suggestedPrice - price) : null;

  return {
    recipeCostExact,
    recipeCostDisplay: hasRecipe && recipeCostExact != null ? roundMoney2(recipeCostExact) : null,
    netPrice,
    price,
    marginAmount: canShowMargin ? metrics.marginAmount : null,
    marginPercent: canShowMargin ? metrics.marginPercent : null,
    foodCostPercent: canShowMargin ? metrics.foodCostPercent : null,
    status,
    foodCostBand,
    missingIngredients,
    suggestedPrice: canShowMargin ? suggestedPrice : null,
    priceGap: canShowMargin ? priceGap : null,
    breakdown,
  };
}
