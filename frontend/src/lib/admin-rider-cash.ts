import { api } from "./api";
import { RiderCashLedgerEntry, RiderCashSummary } from "./admin-types";

export async function fetchRiderCashSummary() {
  return api<RiderCashSummary>("/admin/rider-cash/summary");
}

export async function fetchRiderCashLedger(opts?: {
  riderId?: string;
  status?: "PENDING" | "SETTLED";
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (opts?.riderId) params.set("riderId", opts.riderId);
  if (opts?.status) params.set("status", opts.status);
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.offset) params.set("offset", String(opts.offset));
  const qs = params.toString();
  return api<{ entries: RiderCashLedgerEntry[]; total: number; limit: number; offset: number }>(
    `/admin/rider-cash/ledger${qs ? `?${qs}` : ""}`
  );
}

export async function settleRiderCash(body: {
  riderId: string;
  entryIds: string[];
  receivedAmount: number;
  note?: string;
}) {
  return api<{ settlementId: string; expectedTotal: number; receivedTotal: number; variance: number }>(
    "/admin/rider-cash/settle",
    { method: "POST", body: JSON.stringify(body) }
  );
}
