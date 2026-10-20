/** Mirror of backend/src/lib/money.ts — keep in sync for POS totals. */
export function toMinorUnits(value: string | number, scale = 2): number {
  const raw = typeof value === "number" ? value.toFixed(scale) : String(value).trim();
  const negative = raw.startsWith("-");
  const [wholeRaw, fracRaw = ""] = raw.replace("-", "").split(".");
  const whole = parseInt(wholeRaw || "0", 10) || 0;
  const frac = (fracRaw.replace(/\D/g, "") + "0".repeat(scale)).slice(0, scale);
  const minor = whole * 10 ** scale + (parseInt(frac || "0", 10) || 0);
  return negative ? -minor : minor;
}

export function fromMinorUnits(minor: number) {
  return minor / 100;
}
