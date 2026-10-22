export type ReportDatePreset = "today" | "7d" | "30d" | "month" | "custom";

function ymdInTimezone(timezone: string, ref: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ref);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

function addDaysYmd(ymd: string, days: number, timezone: string) {
  const noon = new Date(`${ymd}T12:00:00Z`);
  noon.setUTCDate(noon.getUTCDate() + days);
  return ymdInTimezone(timezone, noon);
}

export function resolveReportDateRange(
  preset: ReportDatePreset,
  timezone: string,
  customFrom?: string,
  customTo?: string
): { from: string; to: string } {
  const today = ymdInTimezone(timezone);
  if (preset === "custom") {
    return {
      from: customFrom || today,
      to: customTo || customFrom || today,
    };
  }
  if (preset === "today") return { from: today, to: today };
  if (preset === "7d") return { from: addDaysYmd(today, -6, timezone), to: today };
  if (preset === "30d") return { from: addDaysYmd(today, -29, timezone), to: today };
  if (preset === "month") {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === "year")?.value ?? "1970";
    const m = parts.find((p) => p.type === "month")?.value ?? "01";
    return { from: `${y}-${m}-01`, to: today };
  }
  return { from: addDaysYmd(today, -29, timezone), to: today };
}

export const REPORT_DATE_PRESETS: { id: ReportDatePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "month", label: "This month" },
  { id: "custom", label: "Custom" },
];
