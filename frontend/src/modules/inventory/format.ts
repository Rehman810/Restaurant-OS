import type { InventoryUnit } from "./types";

const PIECE_LIKE = new Set<InventoryUnit>(["PIECE", "PACK"]);

export function formatQty(value: number, unit: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return `0 ${unit}`;
  const piece = PIECE_LIKE.has(unit as InventoryUnit);
  const rounded = piece ? Math.round(n) : Math.round(n * 100) / 100;
  const formatted = rounded.toLocaleString("en-US", {
    minimumFractionDigits: piece ? 0 : 0,
    maximumFractionDigits: piece ? 0 : 2,
  });
  return `${formatted} ${unit}`;
}

export function formatInventoryWhen(iso: string, timezone = "Asia/Karachi") {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: timezone,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
