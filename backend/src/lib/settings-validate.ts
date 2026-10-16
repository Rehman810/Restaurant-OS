import { coerceSchedule, parseMinutes, WEEKDAYS, type WeeklySchedule } from "./hours";

export type SettingsErrors = Record<string, string>;

const PHONE = /^[+0-9][0-9\s().-]{6,19}$/;
const URL = /^https?:\/\/[^\s]+$/i;

function optionalText(value: unknown) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

export function validateSettingsInput(body: Record<string, unknown>): SettingsErrors {
  const errors: SettingsErrors = {};

  if (body.storeName !== undefined && !String(body.storeName).trim()) {
    errors.storeName = "Restaurant name is required.";
  }

  for (const key of ["phone", "whatsapp"] as const) {
    if (body[key] === undefined) continue;
    const value = optionalText(body[key]);
    if (value && !PHONE.test(value)) errors[key] = "Enter a phone number, or leave it blank.";
  }

  for (const key of ["logoUrl", "faviconUrl", "facebookUrl", "instagramUrl", "tiktokUrl", "youtubeUrl"] as const) {
    if (body[key] === undefined) continue;
    const value = optionalText(body[key]);
    if (value && !URL.test(value)) errors[key] = "Enter a full http or https URL, or leave it blank.";
  }

  if (body.latitude !== undefined && body.latitude !== null && body.latitude !== "") {
    const lat = Number(body.latitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) errors.latitude = "Latitude must be between -90 and 90.";
  }
  if (body.longitude !== undefined && body.longitude !== null && body.longitude !== "") {
    const lng = Number(body.longitude);
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) errors.longitude = "Longitude must be between -180 and 180.";
  }

  for (const key of ["taxPercent", "serviceChargePercent"] as const) {
    if (body[key] === undefined || body[key] === null || body[key] === "") continue;
    const n = Number(body[key]);
    if (!Number.isFinite(n) || n < 0 || n > 100) errors[key] = "Enter a percentage from 0 to 100.";
  }

  for (const key of ["confirmSlaMinutes", "deliverySlaMinutes", "deliveryEstimateMin", "pickupEstimateMin"] as const) {
    if (body[key] === undefined || body[key] === "") continue;
    const n = Number(body[key]);
    if (!Number.isInteger(n) || n < 1 || n > 24 * 60) errors[key] = "Enter whole minutes between 1 and 1440.";
  }

  if (body.minimumOrder !== undefined && body.minimumOrder !== "") {
    const n = Number(body.minimumOrder);
    if (!Number.isFinite(n) || n < 0) errors.minimumOrder = "Minimum order must be zero or greater.";
  }
  if (body.freeDeliveryAbove !== undefined && body.freeDeliveryAbove !== null && body.freeDeliveryAbove !== "") {
    const n = Number(body.freeDeliveryAbove);
    if (!Number.isFinite(n) || n < 0) errors.freeDeliveryAbove = "Free-delivery threshold must be zero or greater.";
  }

  if (body.shiftVarianceTolerance !== undefined && body.shiftVarianceTolerance !== "") {
    const n = Number(body.shiftVarianceTolerance);
    if (!Number.isFinite(n) || n < 0) {
      errors.shiftVarianceTolerance = "Variance tolerance must be zero or greater.";
    }
  }

  if (body.autoPrintKitchenTickets !== undefined && body.autoPrintKitchenTickets !== null) {
    if (typeof body.autoPrintKitchenTickets !== "boolean") {
      errors.autoPrintKitchenTickets = "Must be true or false.";
    }
  }

  if (body.riderCashStaleHours !== undefined && body.riderCashStaleHours !== "") {
    const n = Number(body.riderCashStaleHours);
    if (!Number.isInteger(n) || n < 1 || n > 24 * 14) {
      errors.riderCashStaleHours = "Enter whole hours between 1 and 336.";
    }
  }

  if (body.maxCashierDiscountPercent !== undefined && body.maxCashierDiscountPercent !== "") {
    const n = Number(body.maxCashierDiscountPercent);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      errors.maxCashierDiscountPercent = "Enter a percentage from 0 to 100.";
    }
  }

  if (body.weeklySchedule !== undefined && body.weeklySchedule !== null) {
    const schedule = body.weeklySchedule;
    if (typeof schedule !== "object" || Array.isArray(schedule)) {
      errors.weeklySchedule = "Hours must be a weekly schedule.";
    } else {
      const coerced = coerceSchedule(schedule, { openHour: 0, openMinute: 0, closeHour: 23, closeMinute: 59 });
      for (const day of WEEKDAYS) {
        const row = (schedule as Record<string, { closed?: boolean; slots?: { open?: string; close?: string }[] }>)[day];
        if (!row) continue;
        if (row.closed) continue;
        const slots = row.slots ?? [];
        if (!slots.length) errors[`hours.${day}`] = "Add a time slot or mark the day closed.";
        for (const slot of slots) {
          if (parseMinutes(String(slot.open || "")) == null || parseMinutes(String(slot.close || "")) == null) {
            errors[`hours.${day}`] = "Use 24-hour times like 19:00.";
          }
        }
        if (coerced[day].slots.length !== (row.closed ? 0 : slots.length) && !errors[`hours.${day}`]) {
          errors[`hours.${day}`] = "Each day can have up to 3 time slots.";
        }
      }
    }
  }

  return errors;
}

export function needsRestaurantName(name: unknown) {
  return !String(name ?? "").trim();
}

export function paymentSummary(acceptCash: boolean, acceptCard: boolean) {
  const parts = [acceptCash ? "cash on delivery" : null, acceptCard ? "card at the counter" : null].filter(Boolean);
  if (!parts.length) return "Ask the restaurant which payment methods are available.";
  return `You can pay with ${parts.join(" and ")}.`;
}

export function scheduleLooksValid(schedule: WeeklySchedule) {
  return WEEKDAYS.every((day) => schedule[day].closed || schedule[day].slots.length > 0);
}
