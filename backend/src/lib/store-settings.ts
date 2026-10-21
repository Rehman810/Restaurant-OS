import { StoreSettings } from "@prisma/client";
import { coerceSchedule, hoursText } from "./hours";
import { isOnlineOrderingOpen, onlineOrderingClosedMessage, isScheduleOpen } from "./online-ordering";

export function getZonedMinutes(now = new Date(), timeZone = "Asia/Karachi") {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function isWithinHours(
  nowMinutes: number,
  openHour: number,
  openMinute: number,
  closeHour: number,
  closeMinute: number
) {
  const open = openHour * 60 + openMinute;
  const close = closeHour * 60 + closeMinute;
  if (open === close) return true;
  if (open < close) return nowMinutes >= open && nowMinutes < close;
  return nowMinutes >= open || nowMinutes < close;
}

export function scheduleFor(settings: Pick<StoreSettings, "weeklySchedule" | "openHour" | "openMinute" | "closeHour" | "closeMinute">) {
  return coerceSchedule(settings.weeklySchedule, settings);
}

/** @deprecated alias — online ordering availability */
export function isStoreOpen(settings: StoreSettings, now = new Date()) {
  return isOnlineOrderingOpen(settings, now);
}

export { isScheduleOpen, isOnlineOrderingOpen };

export function publicHoursLabel(settings: StoreSettings) {
  return hoursText(scheduleFor(settings));
}

export function publicClosedMessage(settings: StoreSettings, now = new Date()) {
  return onlineOrderingClosedMessage(settings, now);
}

export function formatTime12(h: number, m: number) {
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const mm = m.toString().padStart(2, "0");
  return `${hour12}:${mm} ${period}`;
}

export function storeHoursLabel(settings: StoreSettings) {
  return publicHoursLabel(settings);
}

export function effectiveItemPrice(item: {
  price: { toString(): string } | number;
  discountPrice?: { toString(): string } | number | null;
}) {
  const discount = item.discountPrice != null ? Number(item.discountPrice) : null;
  if (discount != null && discount > 0 && discount < Number(item.price)) return discount;
  return Number(item.price);
}
