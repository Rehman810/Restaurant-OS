/** Derive display short number from full order number (matches kitchen/frontend helper). */
export function deriveShortOrderNumber(orderNumber: string): {
  shortNumber: string;
  shortDisplay: string;
  fullNumber: string;
} {
  const full = orderNumber.trim();
  const segments = full.split(/[-/]/);
  const numeric = segments.filter((p) => /^\d+$/.test(p));
  const lastNum = numeric[numeric.length - 1];
  if (lastNum) {
    return { shortNumber: lastNum, shortDisplay: `#${lastNum}`, fullNumber: full };
  }
  const tail = segments[segments.length - 1] || full;
  const display = tail.startsWith("#") ? tail.slice(1) : tail;
  return {
    shortNumber: display,
    shortDisplay: tail.startsWith("#") ? tail : `#${tail}`,
    fullNumber: full,
  };
}
