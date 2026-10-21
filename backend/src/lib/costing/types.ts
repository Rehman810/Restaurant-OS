export type DishCostStatus = "COMPLETE" | "INCOMPLETE" | "NO_RECIPE" | "SUSPICIOUS_LOW";
export type FoodCostBand = "HEALTHY" | "WATCH" | "HIGH" | "UNKNOWN";
export type CostingItemType = "DISH" | "COMBO";

export type CostingSettingsSlice = {
  foodCostTargetPercent: number;
  foodCostHighPercent: number;
  suggestedPriceRoundingStep: number;
  suspiciousLowCostFraction: number;
  ingredientPriceChangeAlertPercent: number;
  taxEnabled: boolean;
  taxPercent: number;
  pricesIncludeTax: boolean;
  taxIncluded: boolean;
};

export type IngredientCostSource = "BRANCH_AVG" | "DEFAULT" | "MISSING";

export type RecipeLineCost = {
  ingredientId: string;
  ingredientName: string;
  quantityPerDish: number;
  unit: string;
  unitCost: number | null;
  lineCost: number | null;
  shareOfTotal: number | null;
  costSource: IngredientCostSource;
};

export type DishEconomics = {
  recipeCostExact: number | null;
  recipeCostDisplay: number | null;
  netPrice: number;
  price: number;
  marginAmount: number | null;
  marginPercent: number | null;
  foodCostPercent: number | null;
  status: DishCostStatus;
  foodCostBand: FoodCostBand;
  missingIngredients: string[];
  suggestedPrice: number | null;
  priceGap: number | null;
};
