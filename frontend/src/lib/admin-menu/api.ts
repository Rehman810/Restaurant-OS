import { api } from "@/lib/api";
import type {
  AdminCategoryListResponse,
  AdminCategoryRow,
  AdminDealListResponse,
  AdminDishListResponse,
  CategoryStatusFilter,
  DealStatusFilter,
  DishStatusFilter,
} from "./types";

export type FetchAdminDishesParams = {
  q?: string;
  categoryId?: string;
  status?: DishStatusFilter[];
  tag?: string;
  page?: number;
  pageSize?: number;
};

export function fetchAdminDishes(params: FetchAdminDishesParams) {
  const sp = new URLSearchParams();
  if (params.q?.trim()) sp.set("q", params.q.trim());
  if (params.categoryId) sp.set("categoryId", params.categoryId);
  for (const s of params.status ?? []) sp.append("status[]", s);
  if (params.tag) sp.set("tag", params.tag);
  if (params.page) sp.set("page", String(params.page));
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));
  const qs = sp.toString();
  return api<AdminDishListResponse>(`/admin/menu/dishes${qs ? `?${qs}` : ""}`);
}

export type AvailabilityPatch = {
  state: "available" | "soldOut";
  until?: null | "endOfDay" | string;
  scope?: "currentBranch" | "allBranches";
};

export function fetchAdminDeals(params: {
  q?: string;
  group?: string;
  status?: DealStatusFilter[];
  page?: number;
  pageSize?: number;
}) {
  const sp = new URLSearchParams();
  if (params.q?.trim()) sp.set("q", params.q.trim());
  if (params.group) sp.set("group", params.group);
  for (const s of params.status ?? []) sp.append("status[]", s);
  if (params.page) sp.set("page", String(params.page));
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));
  const qs = sp.toString();
  return api<AdminDealListResponse>(`/admin/menu/deals${qs ? `?${qs}` : ""}`);
}

export function patchDealVisibility(id: string, visible: boolean) {
  return api<{ ok: boolean }>(`/admin/menu/deals/${id}/visibility`, {
    method: "PATCH",
    body: JSON.stringify({ visible }),
  });
}

export function patchDealAvailability(id: string, body: AvailabilityPatch) {
  return api<{ ok: boolean }>(`/admin/menu/deal/${id}/availability`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function patchDishAvailability(id: string, body: AvailabilityPatch) {
  return api<{ ok: boolean }>(`/admin/menu/dish/${id}/availability`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function patchDishVisibility(id: string, visible: boolean) {
  return api<{ ok: boolean }>(`/admin/menu/dishes/${id}/visibility`, {
    method: "PATCH",
    body: JSON.stringify({ visible }),
  });
}

export function duplicateDish(id: string) {
  return api<{ id: string }>(`/admin/menu/dishes/${id}/duplicate`, { method: "POST" });
}

export function archiveDish(id: string, archive = true) {
  return api<{ ok: boolean }>(`/admin/menu/dishes/${id}/archive`, {
    method: "POST",
    body: JSON.stringify({ archive }),
  });
}

export function deleteDish(id: string) {
  return api<{ ok: boolean } | { error: string; usage?: unknown; suggestArchive?: boolean }>(
    `/admin/menu/dishes/${id}`,
    { method: "DELETE" }
  );
}

export function reorderDishes(category: string, orderedIds: string[]) {
  return api<{ ok: boolean }>(`/admin/menu/dishes/reorder`, {
    method: "PUT",
    body: JSON.stringify({ category, orderedIds }),
  });
}

export type BulkActionBody =
  | { action: "setAvailability"; payload: AvailabilityPatch }
  | { action: "setVisibility"; visible: boolean }
  | { action: "moveCategory"; category: string }
  | { action: "adjustPrice"; mode: "percent" | "fixed"; value: number; dryRun?: boolean }
  | { action: "archive" };

export function fetchAdminCategories(params?: {
  q?: string;
  status?: CategoryStatusFilter[];
  includeArchived?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const sp = new URLSearchParams();
  if (params?.q?.trim()) sp.set("q", params.q.trim());
  for (const s of params?.status ?? []) sp.append("status[]", s);
  if (params?.includeArchived) sp.set("includeArchived", "true");
  if (params?.page) sp.set("page", String(params.page));
  if (params?.pageSize) sp.set("pageSize", String(params.pageSize));
  const qs = sp.toString();
  return api<AdminCategoryListResponse>(`/admin/menu/categories${qs ? `?${qs}` : ""}`);
}

export function patchCategoryVisibility(id: string, visible: boolean) {
  return api<{ ok: boolean }>(`/admin/menu/categories/${id}/visibility`, {
    method: "PATCH",
    body: JSON.stringify({ visible }),
  });
}

export function reorderCategories(orderedIds: string[]) {
  return api<{ ok: boolean }>(`/admin/menu/categories/reorder`, {
    method: "PUT",
    body: JSON.stringify({ orderedIds }),
  });
}

export function deleteAdminCategory(id: string, moveToCategoryId?: string) {
  return api<{ ok: boolean } | { error: string; requiresMoveTo?: boolean; dishCount?: number }>(
    `/admin/menu/categories/${id}`,
    { method: "DELETE", body: JSON.stringify(moveToCategoryId ? { moveToCategoryId } : {}) }
  );
}

export function updateAdminCategory(id: string, body: Record<string, unknown>) {
  return api<AdminCategoryRow>(`/admin/menu/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function menuBulk(ids: string[], body: BulkActionBody) {
  return api<{ results?: { id: string; ok: boolean; error?: string; preview?: unknown }[]; dryRun?: boolean }>(
    `/admin/menu/bulk`,
    { method: "POST", body: JSON.stringify({ ids, ...body }) }
  );
}
