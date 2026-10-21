import { resolveAuditActionMeta } from "./audit-actions";

const STATUS_LABELS: Record<string, string> = {
  PENDING_CONFIRMATION: "Awaiting confirmation",
  CONFIRMED: "Confirmed",
  PREPARING: "Cooking",
  READY: "Ready",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  COLLECTED: "Collected",
  SERVED: "Served",
  CANCELLED: "Cancelled",
};

function labelStatus(s: unknown) {
  if (typeof s !== "string") return String(s ?? "—");
  return STATUS_LABELS[s] ?? s.replace(/_/g, " ").toLowerCase();
}

function record(v: unknown): Record<string, unknown> | null {
  if (v == null || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

export function buildAuditSummary(input: {
  action: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  meta?: unknown;
}): string {
  const { action, before, after, reason } = input;
  const b = record(before);
  const a = record(after);
  const meta = resolveAuditActionMeta(action);

  if (b?.status != null && a?.status != null) {
    return `${labelStatus(b.status)} → ${labelStatus(a.status)}`;
  }
  if (b?.from != null && a?.to != null) {
    return `${labelStatus(b.from)} → ${labelStatus(a.to)}`;
  }
  if (a?.kotPrint || a?.isReprint) {
    return a.isReprint ? "Kitchen ticket reprinted" : "Kitchen ticket printed";
  }
  if (a?.refundAmount != null) {
    return `Refund Rs ${Number(a.refundAmount).toLocaleString("en-US")}`;
  }
  if (a?.discountAmount != null || a?.discountPercent != null) {
    const pct = a.discountPercent != null ? `${a.discountPercent}%` : "";
    const amt = a.discountAmount != null ? `Rs ${Number(a.discountAmount).toLocaleString("en-US")}` : "";
    return ["Discount", pct, amt].filter(Boolean).join(" ");
  }
  if (a?.variance != null && a?.expectedCash != null) {
    return `Expected Rs ${Number(a.expectedCash).toLocaleString("en-US")}, variance Rs ${Number(a.variance).toLocaleString("en-US")}`;
  }
  if (a?.receivedTotal != null || a?.amount != null) {
    const amt = a.receivedTotal ?? a.amount;
    return `Settled Rs ${Number(amt).toLocaleString("en-US")}`;
  }
  if (b?.role != null && a?.role != null) {
    return `${String(b.role)} → ${String(a.role)}`;
  }
  if (reason) return reason;
  return meta.label;
}
