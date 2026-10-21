import { api } from "./api";
import type { StaffListParams, StaffListRow, StaffTileCounts } from "@/modules/staff/types";

export const STAFF_PAGE_SIZE = 25;

export function buildStaffQuery(params: StaffListParams): string {
  const q = new URLSearchParams();
  if (params.q?.trim()) q.set("q", params.q.trim());
  if (params.role?.length) params.role.forEach((r) => q.append("role", r));
  if (params.branchId) q.set("branchId", params.branchId);
  if (params.status?.length) params.status.forEach((s) => q.append("status", s));
  if (params.twoFa) q.set("twoFa", params.twoFa);
  if (params.lastActive) q.set("lastActive", params.lastActive);
  if (params.includeTest) q.set("includeTest", "true");
  if (params.sort) q.set("sort", params.sort);
  if (params.order) q.set("order", params.order);
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  return q.toString();
}

export async function fetchStaffPage(params: StaffListParams) {
  const qs = buildStaffQuery({
    pageSize: STAFF_PAGE_SIZE,
    sort: "name",
    order: "asc",
    ...params,
  });
  return api<{
    staff: StaffListRow[];
    total: number;
    page: number;
    pageSize: number;
    offset: number;
    counts: StaffTileCounts;
    stats: { total: number; chefs: number; riders: number; active: number };
  }>(`/admin/staff${qs ? `?${qs}` : ""}`);
}

export type { StaffListRow } from "@/modules/staff/types";
