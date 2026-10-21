type Currency = { code: string; symbol: string; digits: number };

const ZERO_DECIMAL = new Set(["PKR", "JPY", "KRW", "VND", "CLP"]);

let current: Currency = { code: "PKR", symbol: "Rs", digits: 0 };

export function setDisplayCurrency(next: { currencyCode?: string | null; currencySymbol?: string | null }) {
  const code = (next.currencyCode || "PKR").toUpperCase();
  current = {
    code,
    symbol: (next.currencySymbol || "Rs").trim() || "Rs",
    digits: ZERO_DECIMAL.has(code) ? 0 : 2,
  };
}

/** Grouped money for the active restaurant. PKR renders as `Rs 1,234` with no stray decimals. */
export function formatMoney(n: string | number | null | undefined) {
  const value = Number(n ?? 0);
  const safe = Number.isFinite(value) ? value : 0;
  const factor = 10 ** current.digits;
  const rounded = Math.round(safe * factor) / factor;
  const formatted = rounded.toLocaleString("en-US", {
    minimumFractionDigits: current.digits,
    maximumFractionDigits: current.digits,
  });
  return `${current.symbol} ${formatted}`;
}

export const pkr = formatMoney;

export function eta(createdAt: string) {
  const start = new Date(createdAt).getTime();
  const min = new Date(start + 30 * 60_000);
  const max = new Date(start + 45 * 60_000);
  const fmt = (d: Date) =>
    d.toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit" });
  return `${fmt(min)} – ${fmt(max)}`;
}

export function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-PK", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatRelativeDays(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatElapsed(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  return formatWhen(iso);
}
