import { api } from "@/lib/api";
import type { OrderStatus } from "@/lib/types";
import type {
  AdminBulkResult,
  AdminOrderDetail,
  AdminOrdersListResponse,
  AdminOrdersSort,
  AdminPaymentFilter,
  AdminOrderSource,
} from "./types";
import type { FulfillmentType } from "@/lib/types";

export type FetchAdminOrdersParams = {
  from?: string;
  to?: string;
  statuses?: OrderStatus[];
  types?: FulfillmentType[];
  sources?: AdminOrderSource[];
  payment?: AdminPaymentFilter[];
  riderId?: string;
  branchId?: string;
  q?: string;
  sort?: AdminOrdersSort;
  page?: number;
  pageSize?: number;
};

export function buildAdminOrdersQuery(params: FetchAdminOrdersParams) {
  const qs = new URLSearchParams();
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  for (const s of params.statuses ?? []) qs.append("status[]", s);
  for (const t of params.types ?? []) qs.append("type[]", t);
  for (const s of params.sources ?? []) qs.append("source[]", s);
  if (params.payment?.length) qs.set("payment", params.payment.join(","));
  if (params.riderId) qs.set("riderId", params.riderId);
  if (params.branchId) qs.set("branchId", params.branchId);
  if (params.q?.trim()) qs.set("q", params.q.trim());
  if (params.sort) qs.set("sort", params.sort);
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  return qs.toString();
}

export async function fetchAdminOrdersDispatch(params: FetchAdminOrdersParams) {
  const qs = buildAdminOrdersQuery(params);
  return api<AdminOrdersListResponse>(`/admin/orders${qs ? `?${qs}` : ""}`);
}

export async function transitionAdminOrder(
  id: string,
  body: {
    targetStatus: OrderStatus;
    reason?: string;
    voidReasonCode?: string;
    voidReasonNote?: string;
    approval?: { approverId: string; pin: string };
    boardUndo?: boolean;
  }
) {
  return api<{ ok: boolean; orderId: string; status: OrderStatus }>(`/admin/orders/${id}/transition`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function assignAdminOrderRider(id: string, riderId: string) {
  return api<{ ok: boolean; orderId: string; riderId: string }>(`/admin/orders/${id}/assign-rider`, {
    method: "POST",
    body: JSON.stringify({ riderId }),
  });
}

export async function fetchAdminOrderDetail(id: string) {
  return api<AdminOrderDetail>(`/admin/orders/${id}`);
}

export async function bulkAdminOrders(body: {
  ids: string[];
  action: "transition" | "assignRider" | "printKot" | "cancelStale";
  targetStatus?: OrderStatus;
  riderId?: string;
  reason?: string;
  voidReasonCode?: string;
  voidReasonNote?: string;
}) {
  return api<AdminBulkResult>("/admin/orders/bulk", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
