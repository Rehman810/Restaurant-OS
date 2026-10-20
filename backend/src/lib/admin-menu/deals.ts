export function dealComponentSum(
  items: { quantity: number; menuItem: { price: { toString(): string } | number } }[]
): number {
  return items.reduce((sum, row) => sum + Number(row.menuItem.price) * row.quantity, 0);
}

export function dealSavings(componentSum: number, dealPrice: number): number {
  return Math.max(0, Math.round((componentSum - dealPrice) * 100) / 100);
}

export function dealPriceWarning(componentSum: number, dealPrice: number): boolean {
  return dealPrice >= componentSum && componentSum > 0;
}

export type DealScheduleStatus = "active" | "scheduled" | "expired" | "hidden";

export function evaluateDealSchedule(
  deal: {
    isVisible: boolean;
    isActive: boolean;
    archivedAt: Date | null;
    scheduleStartsAt: Date | null;
    scheduleEndsAt: Date | null;
    scheduleDays: number[];
    scheduleStartMinutes: number | null;
    scheduleEndMinutes: number | null;
  },
  now = new Date(),
  timezone = "Asia/Karachi"
): DealScheduleStatus {
  if (deal.archivedAt || !deal.isVisible || !deal.isActive) return "hidden";
  if (deal.scheduleStartsAt && now < deal.scheduleStartsAt) return "scheduled";
  if (deal.scheduleEndsAt && now > deal.scheduleEndsAt) return "expired";

  if (deal.scheduleDays.length && deal.scheduleStartMinutes != null && deal.scheduleEndMinutes != null) {
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
    if (!deal.scheduleDays.includes(day)) return "scheduled";
    if (mins < deal.scheduleStartMinutes || mins > deal.scheduleEndMinutes) return "scheduled";
  }

  return "active";
}
