export type AuditLogRow = {
  id: string;
  createdAt: string;
  action: string;
  actionLabel: string;
  category: string;
  sensitive: boolean;
  summary: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  entityAdminPath: string | null;
  actor: {
    id: string | null;
    name: string;
    role: string | null;
    kind: "staff" | "rider" | "customer" | "system";
  };
  branch: { id: string; name: string; code: string } | null;
  before: unknown;
  after: unknown;
  meta: unknown;
  reason: string | null;
  ip: string | null;
  userAgent: string | null;
};

export type AuditFilterOptions = {
  categories: string[];
  actionsByCategory: Record<string, { code: string; label: string }[]>;
  entityTypes: string[];
  actors: { id: string; name: string; role: string }[];
};

export function formatAuditWhen(iso: string, timezone: string) {
  return new Date(iso).toLocaleString("en-PK", {
    timeZone: timezone,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatAuditWhenFull(iso: string, timezone: string) {
  return new Date(iso).toLocaleString("en-PK", {
    timeZone: timezone,
    dateStyle: "full",
    timeStyle: "long",
  });
}

function localInTimezoneToUtc(localIso: string, timezone: string): Date {
  const target = new Date(localIso.replace("T", " "));
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  let guess = new Date(
    Date.UTC(
      target.getFullYear(),
      target.getMonth(),
      target.getDate(),
      target.getHours(),
      target.getMinutes(),
      target.getSeconds()
    )
  );
  for (let i = 0; i < 3; i++) {
    const parts = formatter.formatToParts(guess);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    const shown = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour") % 24,
      get("minute"),
      get("second")
    );
    const want = Date.UTC(
      target.getFullYear(),
      target.getMonth(),
      target.getDate(),
      target.getHours(),
      target.getMinutes(),
      target.getSeconds()
    );
    guess = new Date(guess.getTime() + (want - shown));
  }
  return guess;
}

export function branchDayRangeUtc(timezone: string, ref: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ref);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  const startLocal = `${y}-${m}-${d}T00:00:00`;
  const endLocal = `${y}-${m}-${d}T23:59:59.999`;
  return {
    startUtc: localInTimezoneToUtc(startLocal, timezone),
    endUtc: localInTimezoneToUtc(endLocal, timezone),
  };
}

export type DatePreset = "today" | "yesterday" | "7d" | "custom";

export function rangeForPreset(
  preset: DatePreset,
  timezone: string,
  customFrom?: string,
  customTo?: string
): { from?: string; to?: string } {
  if (preset === "custom") {
    return {
      from: customFrom ? new Date(customFrom).toISOString() : undefined,
      to: customTo ? new Date(customTo).toISOString() : undefined,
    };
  }
  const now = new Date();
  if (preset === "7d") {
    const { startUtc: todayStart } = branchDayRangeUtc(timezone, now);
    const from = new Date(todayStart);
    from.setUTCDate(from.getUTCDate() - 6);
    return { from: from.toISOString(), to: now.toISOString() };
  }
  const offset = preset === "yesterday" ? 1 : 0;
  const ref = new Date(now.getTime() - offset * 86400000);
  const { startUtc, endUtc } = branchDayRangeUtc(timezone, ref);
  return { from: startUtc.toISOString(), to: endUtc.toISOString() };
}

export function actorKindLabel(kind: AuditLogRow["actor"]["kind"]) {
  if (kind === "rider") return "Rider";
  if (kind === "customer") return "Customer";
  if (kind === "system") return "System";
  return null;
}
