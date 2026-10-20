import type { AdminOrderRow, AdminOrdersListResponse } from "./types";
import type { FulfillmentType, Order, OrderStatus } from "@/lib/types";
import { pkr } from "@/lib/format";

const COMPLETED: OrderStatus[] = ["DELIVERED", "COLLECTED", "SERVED"];

export function formatAgeSeconds(totalSeconds: number, opts?: { compact?: boolean }): string {
  const secs = Math.max(0, Math.floor(totalSeconds));
  const compact = opts?.compact ?? false;
  const suffix = compact ? "" : " ago";
  if (secs < 60) return compact ? "<1m" : "<1m ago";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m${suffix}`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hrs < 48) return compact ? (rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`) : rem > 0 ? `${hrs}h ${rem}m ago` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  const rh = hrs % 24;
  return compact
    ? rh > 0
      ? `${days}d ${rh}h`
      : `${days}d`
    : rh > 0
      ? `${days}d ${rh}h ago`
      : `${days}d ago`;
}

export function formatAgeCompact(totalSeconds: number) {
  return formatAgeSeconds(totalSeconds, { compact: true });
}

export function paymentBadgeLabel(row: AdminOrderRow): string {
  if (!row.payment) return "—";
  if (row.payment.status === "cod" && row.payment.codAmount != null) {
    return `COD ${pkr(row.payment.codAmount)} due`;
  }
  if (row.payment.status === "partial") return "Partly paid";
  if (row.payment.status === "paid") return row.payment.label || "Paid";
  if (row.payment.status === "unpaid") return "Unpaid";
  return row.payment.label;
}

export function completedOutcomeLabel(
  outcome: AdminOrderRow["outcome"],
  status: OrderStatus
): string {
  if (outcome === "served") return "Served";
  if (outcome === "picked_up") return "Picked up";
  if (outcome === "delivered") return "Delivered";
  if (status === "SERVED") return "Served";
  if (status === "COLLECTED") return "Picked up";
  if (status === "DELIVERED") return "Delivered";
  return "Completed";
}

/** 12-hour clock in store timezone (e.g. 8:47 PM). */
export function formatStoreTime12h(iso: string, timeZone = "Asia/Karachi") {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function dispatchStatusLabel(status: OrderStatus, fulfillment?: FulfillmentType | null) {
  if (COMPLETED.includes(status)) return "Completed";
  if (status === "PENDING_CONFIRMATION") return "Awaiting confirmation";
  if (status === "OUT_FOR_DELIVERY") return "Out for delivery";
  if (status === "PREPARING") return "Preparing";
  if (status === "READY") {
    if (fulfillment === "DINE_IN") return "Ready to serve";
    if (fulfillment === "PICKUP") return "Ready for pickup";
    return "Ready";
  }
  if (status === "CONFIRMED") return "Confirmed";
  if (status === "CANCELLED") return "Cancelled";
  return status;
}

export function normalizeAddressDisplay(raw: string) {
  return raw
    .split(",")
    .map((part) =>
      part
        .trim()
        .split(/\s+/)
        .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""))
        .join(" ")
    )
    .filter(Boolean)
    .join(", ");
}

export function paymentCellLabel(row: AdminOrderRow): string {
  if (!row.payment) return "—";
  if (row.payment.status === "cod" && row.payment.codAmount != null) {
    return `Unpaid · COD ${pkr(row.payment.codAmount)}`;
  }
  return row.payment.label;
}

export function pluralizeItems(n: number) {
  return n === 1 ? "1 item" : `${n} items`;
}

export function csvEscape(value: string) {
  const s = String(value ?? "");
  if (/^[=+\-@]/.test(s)) return `"'${s.replace(/"/g, '""')}"`;
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildOrdersCsv(
  rows: AdminOrderRow[],
  meta: { from: string; to: string; branchLabel: string; timezone: string }
) {
  const bom = "\uFEFF";
  const headerRows = [
    `Period,${csvEscape(`${meta.from} – ${meta.to}`)}`,
    `Branch,${csvEscape(meta.branchLabel)}`,
    `Timezone,${csvEscape(meta.timezone)}`,
    "",
  ];
  const cols = [
    "Order",
    "Type",
    "Status",
    "Customer",
    "Phone",
    "Total",
    "Payment",
    "Created",
  ];
  const lines = rows.map((r) =>
    [
      csvEscape(r.number),
      csvEscape(r.type),
      csvEscape(dispatchStatusLabel(r.status, r.type)),
      csvEscape(r.customer.name),
      csvEscape(r.customer.phone),
      csvEscape(String(r.totals.total)),
      csvEscape(paymentCellLabel(r)),
      csvEscape(r.createdAt),
    ].join(",")
  );
  return bom + [...headerRows, cols.join(","), ...lines].join("\r\n");
}

export function completedStatusCount(summary: AdminOrdersListResponse["summary"]) {
  const c = summary.statusCounts;
  return (c.DELIVERED ?? 0) + (c.COLLECTED ?? 0) + (c.SERVED ?? 0);
}

export function adminRowToLegacyOrder(row: AdminOrderRow): Order {
  return {
    id: row.id,
    orderNumber: row.number,
    status: row.status,
    fulfillmentType: row.type,
    orderSource: row.source === "pos" ? "POS" : "ONLINE",
    customerName: row.customer.name,
    customerPhone: row.customer.phone,
    deliveryAddress: row.address?.text ?? (row.table ? `Table ${row.table}` : "Pickup"),
    total: row.totals.total,
    createdAt: row.createdAt,
    riderId: row.rider?.id ?? null,
    rider: row.rider ? { id: row.rider.id, name: row.rider.name } : null,
    tableNumber: row.table,
    paymentStatus: row.payment?.status === "paid" ? "PAID" : "UNPAID",
    items: row.itemsSummary.lines.map((l, i) => ({
      id: `${row.id}-${i}`,
      menuItemId: "",
      quantity: l.quantity,
      priceAtOrder: 0,
      nameAtOrder: l.name,
      optionsLabel: l.optionsLabel,
      instructions: "",
    })),
  };
}
