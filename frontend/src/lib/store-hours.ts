import {
  closedMessageTemplateExample,
  defaultClosedMessage,
  hoursText,
  nextOpening,
  coerceSchedule,
} from "./hours";
import {
  isOnlineOrderingOpen,
  isScheduleOpen,
  onlineOrderingClosedMessage,
  type OnlineOrderingSettings,
} from "./online-ordering";

export type DayPeriod = "AM" | "PM";

export function formatTime12(h: number, m: number) {
  const period: DayPeriod = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const mm = m.toString().padStart(2, "0");
  return `${hour12}:${mm} ${period}`;
}

export function storeHoursLabel(
  openHour: number,
  openMinute: number,
  closeHour: number,
  closeMinute: number
) {
  return `${formatTime12(openHour, openMinute)} – ${formatTime12(closeHour, closeMinute)}`;
}

export function to12HourParts(hour24: number, minute: number) {
  const period: DayPeriod = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, minute, period };
}

export function from12HourParts(hour12: number, minute: number, period: DayPeriod) {
  const normalized = hour12 % 12;
  const hour = period === "PM" ? normalized + 12 : normalized;
  return { hour, minute };
}

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

export type HoursSettings = OnlineOrderingSettings;

function scheduleOf(settings: HoursSettings) {
  return coerceSchedule(settings.weeklySchedule, settings);
}

export function isStoreOpen(settings: HoursSettings, now = new Date()) {
  return isOnlineOrderingOpen(settings, now);
}

export function isKitchenScheduleOpen(settings: HoursSettings, now = new Date()) {
  return isScheduleOpen(settings, now);
}

export function scheduleHoursLabel(settings: HoursSettings) {
  return hoursText(scheduleOf(settings));
}

export function generatedClosedMessage(settings: HoursSettings, now = new Date()) {
  const schedule = scheduleOf(settings);
  const tz = settings.timezone || "Asia/Karachi";
  if (isKitchenScheduleOpen(settings, now)) {
    return closedMessageTemplateExample(schedule, tz, now);
  }
  return onlineOrderingClosedMessage(settings, now);
}

export function storeStatusLabel(settings: HoursSettings, now = new Date()) {
  const schedule = scheduleOf(settings);
  const tz = settings.timezone || "Asia/Karachi";
  const online = isStoreOpen(settings, now);
  const kitchen = isKitchenScheduleOpen(settings, now);
  const hours = scheduleHoursLabel(settings);

  if (online) return `Online ordering open · ${hours}`;
  if (settings.forceClosed && kitchen) {
    return `Online ordering paused · Kitchen on schedule (${hours})`;
  }
  if (!kitchen) {
    const next = nextOpening(schedule, tz, now);
    return next ? `Closed · Opens ${next.label}` : `Closed · ${hours}`;
  }
  const cutoff = settings.lastOrderCutoffMinutes ?? 0;
  if (cutoff > 0) return `Last orders for today · ${hours}`;
  return `Online ordering closed · ${hours}`;
}
