import { pricesAreTaxInclusive, resolveTaxRatePercent } from "../tax/compute";
import type { CostingSettingsSlice, DishCostStatus, FoodCostBand } from "./types";

export const COST_BASIS_DESCRIPTION =
  "Costs use your average purchase price at this branch. Ingredients with no purchases yet use their default cost.";

export function roundMoney2(n: number) {
  return Math.round(n * 100) / 100;
}

export function roundPercent1(n: number) {
  return Math.round(n * 10) / 10;
}

export function costingSettingsFromStore(settings: {
  foodCostTargetPercent?: { toString(): string } | number | null;
  foodCostHighPercent?: { toString(): string } | number | null;
  suggestedPriceRoundingStep?: number | null;
  suspiciousLowCostFraction?: { toString(): string } | number | null;
  ingredientPriceChangeAlertPercent?: { toString(): string } | number | null;
  taxEnabled?: boolean;
  taxPercent?: { toString(): string } | number | null;
  pricesIncludeTax?: boolean | null;
  taxIncluded?: boolean | null;
}): CostingSettingsSlice {
  const step = Number(settings.suggestedPriceRoundingStep ?? 10);
  const allowed = [1, 5, 10];
  return {
    foodCostTargetPercent: Number(settings.foodCostTargetPercent ?? 32),
    foodCostHighPercent: Number(settings.foodCostHighPercent ?? 40),
    suggestedPriceRoundingStep: allowed.includes(step) ? step : 10,
    suspiciousLowCostFraction: Number(settings.suspiciousLowCostFraction ?? 0.25),
    ingredientPriceChangeAlertPercent: Number(settings.ingredientPriceChangeAlertPercent ?? 10),
    taxEnabled: Boolean(settings.taxEnabled),
    taxPercent: Number(settings.taxPercent ?? 0),
    pricesIncludeTax: Boolean(settings.pricesIncludeTax),
    taxIncluded: Boolean(settings.taxIncluded),
  };
}

/** Menu list price (after discount) before tax extraction. */
export function grossMenuPrice(item: {
  price: { toString(): string } | number;
  discountPrice?: { toString(): string } | number | null;
}) {
  const discount = item.discountPrice != null ? Number(item.discountPrice) : null;
  if (discount != null && discount > 0 && discount < Number(item.price)) return discount;
  return Number(item.price);
}

export function netPriceFromGross(gross: number, settings: CostingSettingsSlice) {
  if (!pricesAreTaxInclusive(settings)) return gross;
  const rate = settings.taxEnabled ? resolveTaxRatePercent(settings) : Number(settings.taxPercent ?? 0);
  if (!Number.isFinite(rate) || rate <= 0) return gross;
  const net = gross / (1 + rate / 100);
  return roundMoney2(net);
}

export function suggestedPriceFromCost(
  recipeCost: number,
  targetFoodCostPercent: number,
  roundingStep: number
) {
  if (!Number.isFinite(recipeCost) || recipeCost <= 0 || targetFoodCostPercent <= 0) return null;
  const raw = recipeCost / (targetFoodCostPercent / 100);
  const step = Math.max(1, roundingStep);
  return Math.ceil(raw / step) * step;
}

export function classifyFoodCostBand(
  foodCostPercent: number | null,
  status: DishCostStatus,
  settings: CostingSettingsSlice
): FoodCostBand {
  if (status !== "COMPLETE") return "UNKNOWN";
  if (foodCostPercent == null || !Number.isFinite(foodCostPercent)) return "UNKNOWN";
  if (foodCostPercent <= settings.foodCostTargetPercent) return "HEALTHY";
  if (foodCostPercent <= settings.foodCostHighPercent) return "WATCH";
  return "HIGH";
}

export function computeMarginMetrics(recipeCostExact: number, netPrice: number) {
  if (netPrice <= 0) {
    return { marginAmount: null, marginPercent: null, foodCostPercent: null };
  }
  const marginAmount = roundMoney2(netPrice - recipeCostExact);
  const marginPercent = roundPercent1(((netPrice - recipeCostExact) / netPrice) * 100);
  const foodCostPercent = roundPercent1((recipeCostExact / netPrice) * 100);
  return { marginAmount, marginPercent, foodCostPercent };
}

export function resolveDishStatus(
  hasRecipe: boolean,
  missingIngredientNames: string[],
  recipeCostExact: number | null,
  categoryMedianCost: number | null,
  suspiciousFraction: number
): DishCostStatus {
  if (!hasRecipe) return "NO_RECIPE";
  if (missingIngredientNames.length > 0) return "INCOMPLETE";
  if (
    recipeCostExact != null &&
    categoryMedianCost != null &&
    categoryMedianCost > 0 &&
    recipeCostExact < categoryMedianCost * suspiciousFraction
  ) {
    return "SUSPICIOUS_LOW";
  }
  return "COMPLETE";
}

export function csvGuardCell(value: string) {
  const s = value.trim();
  if (/^[=+\-@]/.test(s)) return `'${s}`;
  return s;
}
