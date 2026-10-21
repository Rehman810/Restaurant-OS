import type { CustomerDirectoryRow } from "./customer-directory";

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function customersToCsv(rows: CustomerDirectoryRow[]) {
  const header = [
    "name",
    "phone",
    "email",
    "joined",
    "orders",
    "spent",
    "avg_order",
    "last_order_date",
    "segment",
    "type",
  ];
  const lines = [header.join(",")];
  for (const c of rows) {
    const avg =
      c.nonCancelledOrderCount > 0 ? Math.round(c.totalSpent / c.nonCancelledOrderCount) : "";
    const last = c.lastOrder?.createdAt.toISOString() ?? "";
    const joined = c.createdAt.toISOString();
    lines.push(
      [
        csvEscape(c.name),
        csvEscape(c.phone ?? ""),
        csvEscape(c.email),
        joined,
        String(c.orderCount),
        String(Math.round(c.totalSpent)),
        avg === "" ? "" : String(avg),
        last,
        c.segment ?? "",
        c.isGuest ? "guest" : "registered",
      ].join(",")
    );
  }
  return lines.join("\n");
}
