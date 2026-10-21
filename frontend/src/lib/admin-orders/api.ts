import { api, ApiError } from "@/lib/api";
import { isRouteMissingError, loadApiCapabilities } from "@/lib/api-capabilities";
import { fetchAdminOrdersLegacy } from "@/lib/legacy-api/orders-dispatch";
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
  try {
    return await api<AdminOrdersListResponse>(`/admin/orders${qs ? `?${qs}` : ""}`);
  } catch (err) {
    if (isRouteMissingError(err)) {
      await loadApiCapabilities(true);
      return fetchAdminOrdersLegacy(params);
    }
    throw err;
  }
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
  try {
    return await api<{ ok: boolean; orderId: string; status: OrderStatus }>(
      `/admin/orders/${id}/transition`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );
  } catch (err) {
    if (isRouteMissingError(err)) {
      await api(`/orders/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: body.targetStatus, reason: body.reason }),
      });
      return { ok: true, orderId: id, status: body.targetStatus };
    }
    throw err;
  }
}

export async function assignAdminOrderRider(id: string, riderId: string) {
  try {
    return await api<{ ok: boolean; orderId: string; riderId: string }>(
      `/admin/orders/${id}/assign-rider`,
      {
        method: "POST",
        body: JSON.stringify({ riderId }),
      }
    );
  } catch (err) {
    if (isRouteMissingError(err)) {
      await api(`/orders/${id}/assign`, {
        method: "PATCH",
        body: JSON.stringify({ riderId }),
      });
      return { ok: true, orderId: id, riderId };
    }
    throw err;
  }
}

export async function fetchAdminOrderDetail(id: string) {
  try {
    return await api<AdminOrderDetail>(`/admin/orders/${id}`);
  } catch (err) {
    if (isRouteMissingError(err)) {
      return api<AdminOrderDetail>(`/orders/${id}`);
    }
    throw err;
  }
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
