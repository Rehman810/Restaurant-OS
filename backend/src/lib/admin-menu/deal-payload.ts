import { dealComponentSum, dealPriceWarning } from "./deals";

export function dealExtrasFromBody(body: Record<string, unknown>) {
  const isVisible = body.isVisible !== undefined ? body.isVisible !== false : body.isActive !== false;
  return {
    isVisible,
    isActive: isVisible,
    channelOnline: body.channelOnline !== false,
    channelPos: body.channelPos !== false,
    channelDineIn: body.channelDineIn !== false,
    perOrderLimit: body.perOrderLimit != null && body.perOrderLimit !== "" ? Number(body.perOrderLimit) : null,
    scheduleDays: Array.isArray(body.scheduleDays) ? body.scheduleDays.map(Number).filter((n) => n >= 0 && n <= 6) : undefined,
    scheduleStartMinutes: body.scheduleStartMinutes != null ? Number(body.scheduleStartMinutes) : undefined,
    scheduleEndMinutes: body.scheduleEndMinutes != null ? Number(body.scheduleEndMinutes) : undefined,
    scheduleStartsAt: body.scheduleStartsAt ? new Date(String(body.scheduleStartsAt)) : undefined,
    scheduleEndsAt: body.scheduleEndsAt ? new Date(String(body.scheduleEndsAt)) : undefined,
  };
}

export function dealWarningsFromItems(
  dealPrice: number,
  items: { quantity: number; menuItem: { price: { toString(): string }; archivedAt?: Date | null } }[]
) {
  const warnings: string[] = [];
  const archived = items.filter((i) => i.menuItem.archivedAt);
  if (archived.length) warnings.push("Deal includes archived dishes.");
  const sum = dealComponentSum(items);
  if (dealPriceWarning(sum, dealPrice)) {
    warnings.push("Deal price is at or above the sum of component prices.");
  }
  return warnings;
}
