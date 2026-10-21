export type FoodCostBand = "HEALTHY" | "WATCH" | "HIGH" | "UNKNOWN";
export type DishCostStatus = "COMPLETE" | "INCOMPLETE" | "NO_RECIPE" | "SUSPICIOUS_LOW";

export const COST_BASIS_COPY =
  "Costs use your average purchase price at this branch. Ingredients with no purchases yet use their default cost.";

export function formatCostMoney(symbol: string, amount: number | null | undefined) {
  if (amount == null || !Number.isFinite(amount)) return "—";
  const formatted = amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${symbol} ${formatted}`;
}

export function formatPercent1(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

export function bandLabel(band: FoodCostBand) {
  switch (band) {
    case "HEALTHY":
      return "On target";
    case "WATCH":
      return "Above target";
    case "HIGH":
      return "High food cost";
    default:
      return "Unknown";
  }
}

export function statusLabel(status: DishCostStatus) {
  switch (status) {
    case "NO_RECIPE":
      return "No recipe";
    case "INCOMPLETE":
      return "Check recipe";
    case "SUSPICIOUS_LOW":
      return "Check recipe";
    default:
      return null;
  }
}

export function needsRecipeCheck(status: DishCostStatus) {
  return status === "INCOMPLETE" || status === "NO_RECIPE" || status === "SUSPICIOUS_LOW";
}

export function canShowMargin(status: DishCostStatus) {
  return status === "COMPLETE" || status === "SUSPICIOUS_LOW";
}
