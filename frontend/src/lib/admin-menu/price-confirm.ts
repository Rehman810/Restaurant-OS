/** Default threshold — confirm inline price edits above this % change. */
export const DEFAULT_PRICE_CONFIRM_PERCENT = 10;

export function priceChangeNeedsConfirm(
  oldPrice: number,
  newPrice: number,
  thresholdPercent = DEFAULT_PRICE_CONFIRM_PERCENT
): boolean {
  if (oldPrice <= 0) return false;
  const pct = Math.abs((newPrice - oldPrice) / oldPrice) * 100;
  return pct >= thresholdPercent;
}
