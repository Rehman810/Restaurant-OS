export type CategoryScheduleStatus = "active" | "scheduled" | "hidden";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function categoryScheduleSummary(cat: {
  scheduleDays: number[];
  scheduleStartMinutes: number | null;
  scheduleEndMinutes: number | null;
}): string {
  if (!cat.scheduleDays.length || cat.scheduleStartMinutes == null || cat.scheduleEndMinutes == null) {
    return "Always on menu";
  }
  const days = [...cat.scheduleDays].sort((a, b) => a - b).map((d) => DAY_LABELS[d] ?? "?").join(", ");
  return `${days} · ${minutesToTime(cat.scheduleStartMinutes)}–${minutesToTime(cat.scheduleEndMinutes)}`;
}

export function evaluateCategorySchedule(
  cat: {
    isVisible: boolean;
    archivedAt: Date | null;
    scheduleDays: number[];
    scheduleStartMinutes: number | null;
    scheduleEndMinutes: number | null;
  },
  now = new Date(),
  timezone = "Asia/Karachi"
): CategoryScheduleStatus {
  if (cat.archivedAt || !cat.isVisible) return "hidden";

  if (cat.scheduleDays.length && cat.scheduleStartMinutes != null && cat.scheduleEndMinutes != null) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(now);
    const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const day = dayMap[weekday.slice(0, 3)] ?? -1;
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    const mins = hour * 60 + minute;
    if (!cat.scheduleDays.includes(day)) return "scheduled";
    if (mins < cat.scheduleStartMinutes || mins > cat.scheduleEndMinutes) return "scheduled";
  }

  return "active";
}
