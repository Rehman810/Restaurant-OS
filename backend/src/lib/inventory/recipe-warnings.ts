import { LOW_FOOD_COST_PCT } from "./stock-status";

export function recipeEditorWarnings(input: {
  foodCostPercent: number | null;
  ingredientCount: number;
}) {
  const warnings: string[] = [];
  if (input.ingredientCount > 0 && input.ingredientCount < 3) {
    warnings.push("Recipe has fewer than 3 ingredients — portions may be incomplete.");
  }
  if (
    input.foodCostPercent != null &&
    input.ingredientCount > 0 &&
    input.foodCostPercent < LOW_FOOD_COST_PCT
  ) {
    warnings.push("Food cost looks too low — ingredients may be missing.");
  }
  return warnings;
}
