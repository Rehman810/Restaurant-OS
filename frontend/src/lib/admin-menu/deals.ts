/** Mirrors backend/src/lib/admin-menu/deals.ts for UI and tests. */

export function dealComponentSum(items: { quantity: number; menuItem: { price: number } }[]): number {
  return items.reduce((sum, row) => sum + Number(row.menuItem.price) * row.quantity, 0);
}

export function dealSavings(componentSum: number, dealPrice: number): number {
  return Math.max(0, Math.round((componentSum - dealPrice) * 100) / 100);
}

export function dealPriceWarning(componentSum: number, dealPrice: number): boolean {
  return dealPrice >= componentSum && componentSum > 0;
}
