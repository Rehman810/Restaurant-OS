import type { DishCostStatus, FoodCostBand } from "@/lib/costing/helpers";

export type DishCostingRow = {
  id: string;
  name: string;
  category: string;
  type: "DISH" | "COMBO";
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
};

export type DishCostingResponse = {
  items: DishCostingRow[];
  summary: {
    dishCount: number;
    averageFoodCostPercentWeighted: number | null;
    averageFoodCostPercentUnweighted: number | null;
    bandCounts: Record<FoodCostBand, number>;
    statusCounts: Record<DishCostStatus, number>;
    estimatedMonthlyShortfall: number;
    costAsOf: string;
    costBasis: string;
  };
  meta: {
    branch: { id: string; name: string };
    timezone: string;
    targetFoodCostPercent: number;
    highFoodCostPercent: number;
    priceBasisLabel: string;
    salesRange: { from: string; to: string } | null;
  };
  pagination: { page: number; pageSize: number; total: number };
};
