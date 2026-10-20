import type {
  CategoryStatusFilter,
  DealStatusFilter,
  DishStatusFilter,
  DishViewMode,
} from "./types";

const VIEW_KEY = "uff-menu-dish-view";

export function readViewMode(): DishViewMode {
  if (typeof window === "undefined") return "grid";
  const v = localStorage.getItem(VIEW_KEY);
  if (v === "list" || v === "compact" || v === "grid") return v;
  return "grid";
}

export function persistViewMode(mode: DishViewMode) {
  localStorage.setItem(VIEW_KEY, mode);
}

export function parseStatusParams(raw: string | null): DishStatusFilter[] {
  if (!raw) return [];
  return raw.split(",").filter(Boolean) as DishStatusFilter[];
}

export function statusToParam(status: DishStatusFilter[]): string | undefined {
  if (!status.length) return undefined;
  return status.join(",");
}

const DEAL_STATUS: DealStatusFilter[] = ["active", "scheduled", "expired", "hidden"];

export function parseDealStatusParams(raw: string | null): DealStatusFilter[] {
  if (!raw) return [];
  return raw
    .split(",")
    .filter((s): s is DealStatusFilter => DEAL_STATUS.includes(s as DealStatusFilter));
}

export function dealStatusToParam(status: DealStatusFilter[]): string | undefined {
  if (!status.length) return undefined;
  return status.join(",");
}

const CATEGORY_STATUS: CategoryStatusFilter[] = ["active", "scheduled", "hidden"];

export function parseCategoryStatusParams(raw: string | null): CategoryStatusFilter[] {
  if (!raw) return [];
  return raw
    .split(",")
    .filter((s): s is CategoryStatusFilter => CATEGORY_STATUS.includes(s as CategoryStatusFilter));
}

export function categoryStatusToParam(status: CategoryStatusFilter[]): string | undefined {
  if (!status.length) return undefined;
  return status.join(",");
}

export function parseView(raw: string | null): DishViewMode {
  if (raw === "list" || raw === "compact" || raw === "grid") return raw;
  return readViewMode();
}
