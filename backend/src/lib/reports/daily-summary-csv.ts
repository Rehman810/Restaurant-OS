import { buildDailyCloseOut } from "./daily-close-out";

type Payload = Awaited<ReturnType<typeof buildDailyCloseOut>>;

function csvEscape(v: string | number | null | undefined) {
  const s = String(v ?? "");
  if (/^[=+\-@]/.test(s)) return `"'${s.replace(/"/g, '""')}"`;
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function dailySummaryToCsv(payload: Payload) {
  const lines: string[] = [];
  lines.push("\uFEFF");
  lines.push(`# date,${csvEscape(payload.meta.date)}`);
  lines.push(`# branch,${csvEscape(payload.meta.branch.name)}`);
  lines.push(`# timezone,${csvEscape(payload.meta.timezone)}`);
  lines.push(`# status,${csvEscape(payload.meta.status)}`);
  lines.push(`# generatedAt,${csvEscape(payload.meta.generatedAt)}`);
  lines.push("");
  lines.push("section,metric,value");
  lines.push(`money,booked,${payload.money.booked.value}`);
  lines.push(`money,collected,${payload.money.collected.value}`);
  lines.push(`money,notYetCollected,${payload.money.notYetCollected.total}`);
  lines.push(`money,cash,${payload.money.paymentSplit.cash}`);
  lines.push(`money,card,${payload.money.paymentSplit.card}`);
  lines.push(`money,codReceived,${payload.money.paymentSplit.codReceived}`);
  lines.push(`orders,total,${payload.orders.total.value}`);
  lines.push(`orders,completed,${payload.orders.completed.value}`);
  lines.push(`orders,cancelled,${payload.orders.cancelled.value}`);
  lines.push("");
  lines.push("topItems,name,kind,qty,revenue,share");
  for (const row of payload.topItems as { name: string; kind: string; quantity: number; revenue: number; share: number }[]) {
    lines.push(
      [
        "topItem",
        csvEscape(row.name),
        row.kind,
        String(row.quantity),
        String(row.revenue),
        String(row.share),
      ].join(",")
    );
  }
  return lines.join("\n");
}
