import { api, apiBlob } from "./api";
import { AdminCustomer, AdminCustomerDetail, CustomerSegment } from "./admin-types";
import { FulfillmentType, OrderStatus } from "./types";

export type CustomerSort = "spent" | "orders" | "name" | "recent";
export type CustomerSegmentFilter = CustomerSegment | "all";

export type CustomersPageResponse = {
  customers: AdminCustomer[];
  total: number;
  limit: number;
  offset: number;
  stats: {
    count: number;
    totalRevenue: number;
    totalOrders: number;
    nonCancelledOrders?: number;
    avgSpend: number;
    avgOrderValue?: number;
    repeatRate: number;
    topSpenderId?: string;
  };
};

export type CustomerOrderRow = {
  id: string;
  orderNumber: string;
  total: number;
  status: OrderStatus;
  createdAt: string;
  fulfillmentType: FulfillmentType;
};

export async function fetchCustomersPage(opts?: {
  limit?: number;
  offset?: number;
  search?: string;
  sort?: CustomerSort;
  segment?: CustomerSegmentFilter;
}) {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.offset) params.set("offset", String(opts.offset));
  if (opts?.search?.trim()) params.set("search", opts.search.trim());
  if (opts?.sort) params.set("sort", opts.sort);
  if (opts?.segment && opts.segment !== "all") params.set("segment", opts.segment);
  const qs = params.toString();
  return api<CustomersPageResponse>(`/admin/customers${qs ? `?${qs}` : ""}`);
}

export async function fetchCustomerDetail(customerId: string) {
  return api<AdminCustomerDetail>(`/admin/customers/${encodeURIComponent(customerId)}`);
}

export async function saveCustomerNotes(customerId: string, internalNotes: string) {
  return api<{ internalNotes: string; updatedAt: string }>(
    `/admin/customers/${encodeURIComponent(customerId)}/notes`,
    { method: "PATCH", body: JSON.stringify({ internalNotes }) }
  );
}

export async function fetchCustomerOrders(customerId: string, opts?: { limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.offset) params.set("offset", String(opts.offset));
  const qs = params.toString();
  return api<{ orders: CustomerOrderRow[]; total: number; limit: number; offset: number }>(
    `/admin/customers/${encodeURIComponent(customerId)}/orders${qs ? `?${qs}` : ""}`
  );
}

export async function downloadCustomersCsv(opts?: {
  search?: string;
  sort?: CustomerSort;
  segment?: CustomerSegmentFilter;
}) {
  const params = new URLSearchParams();
  if (opts?.search?.trim()) params.set("search", opts.search.trim());
  if (opts?.sort) params.set("sort", opts.sort);
  if (opts?.segment && opts.segment !== "all") params.set("segment", opts.segment);
  const qs = params.toString();
  const blob = await apiBlob(`/admin/customers/export${qs ? `?${qs}` : ""}`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "customers.csv";
  a.click();
  URL.revokeObjectURL(url);
}
