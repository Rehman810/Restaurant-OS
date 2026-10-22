const PKT = "Asia/Karachi";

export function formatPkr(amount: number) {
  return `Rs ${Math.round(amount).toLocaleString("en-PK")}`;
}

export function formatPktDate(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: PKT,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function formatRelativePkt(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return formatPktDate(d);
}
