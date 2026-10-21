import { coerceSchedule, parseMinutes, WEEKDAYS, type WeeklySchedule } from "./hours";

export type SettingsFieldError = { code: string; message: string };
export type SettingsErrors = Record<string, SettingsFieldError>;

const PHONE = /^\+[0-9]{10,15}$/;
const HTTPS_URL = /^https:\/\/[^\s]+$/i;
const MEDIA_URL = /^(https:\/\/[^\s]+|\/[^\s]*)$/i;

const SOCIAL_URL_KEYS = ["facebookUrl", "instagramUrl", "tiktokUrl", "youtubeUrl"] as const;
const MEDIA_KEYS = ["logoUrl", "faviconUrl"] as const;

function err(code: string, message: string): SettingsFieldError {
  return { code, message };
}

function optionalText(value: unknown) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

/** Normalize Pakistani phone numbers to +92… */
export function normalizePkPhone(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("92")) return `+${digits}`;
  if (digits.startsWith("0")) return `+92${digits.slice(1)}`;
  return `+92${digits}`;
}

export function normalizeSettingsPatch(body: Record<string, unknown>): Record<string, unknown> {
  const next = { ...body };
  if (next.phone !== undefined) next.phone = normalizePkPhone(String(next.phone));
  if (next.whatsapp !== undefined) next.whatsapp = normalizePkPhone(String(next.whatsapp));
  return next;
}

function validateEmailList(value: string): SettingsFieldError | null {
  if (!value.trim()) return null;
  const parts = value.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
  for (const email of parts) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return err("ANALYTICS_EMAIL_INVALID", "Enter valid email addresses separated by commas.");
    }
  }
  return null;
}

export function validateSettingsInput(body: Record<string, unknown>): SettingsErrors {
  const errors: SettingsErrors = {};

  if (body.storeName !== undefined && !String(body.storeName).trim()) {
    errors.storeName = err("STORE_NAME_REQUIRED", "Restaurant name is required.");
  }

  for (const key of ["phone", "whatsapp"] as const) {
    if (body[key] === undefined) continue;
    const value = optionalText(body[key]);
    if (value && !PHONE.test(value)) {
      errors[key] = err("PHONE_INVALID", "Use a Pakistan number with country code, e.g. +923001234567.");
    }
  }

  for (const key of MEDIA_KEYS) {
    if (body[key] === undefined) continue;
    const value = optionalText(body[key]);
    if (value && !MEDIA_URL.test(value)) {
      errors[key] = err("URL_INVALID", "Use an https link or an uploaded path starting with /.");
    }
  }

  for (const key of SOCIAL_URL_KEYS) {
    if (body[key] === undefined) continue;
    const value = optionalText(body[key]);
    if (value && !HTTPS_URL.test(value)) {
      errors[key] = err("SOCIAL_URL_HTTPS", "Social links must start with https://.");
    }
  }

  if (body.latitude !== undefined && body.latitude !== null && body.latitude !== "") {
    const lat = Number(body.latitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      errors.latitude = err("LATITUDE_RANGE", "Latitude must be between -90 and 90.");
    }
  }
  if (body.longitude !== undefined && body.longitude !== null && body.longitude !== "") {
    const lng = Number(body.longitude);
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      errors.longitude = err("LONGITUDE_RANGE", "Longitude must be between -180 and 180.");
    }
  }

  for (const key of [
    "taxPercent",
    "serviceChargePercent",
    "foodCostTargetPercent",
    "foodCostHighPercent",
    "ingredientPriceChangeAlertPercent",
  ] as const) {
    if (body[key] === undefined || body[key] === null || body[key] === "") continue;
    const n = Number(body[key]);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      errors[key] = err("PERCENT_RANGE", "Enter a percentage from 0 to 100.");
    }
  }

  for (const mapKey of ["taxRatesByFulfillment", "taxRatesByPayment"] as const) {
    if (body[mapKey] === undefined) continue;
    const raw = body[mapKey];
    if (raw !== null && (typeof raw !== "object" || Array.isArray(raw))) {
      errors[mapKey] = err("TAX_RATES", "Rates must be a map of percentages.");
      continue;
    }
    if (!raw) continue;
    for (const v of Object.values(raw as Record<string, unknown>)) {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        errors[mapKey] = err("TAX_RATES", "Each rate must be between 0 and 100.");
        break;
      }
    }
  }

  if (body.taxRoundingRule !== undefined && body.taxRoundingRule !== "") {
    const rule = String(body.taxRoundingRule);
    if (!["HALF_UP", "HALF_DOWN", "FLOOR", "CEILING"].includes(rule)) {
      errors.taxRoundingRule = err("TAX_ROUNDING", "Choose a valid rounding rule.");
    }
  }

  if (body.foodCostTargetPercent !== undefined && body.foodCostHighPercent !== undefined) {
    const target = Number(body.foodCostTargetPercent);
    const high = Number(body.foodCostHighPercent);
    if (Number.isFinite(target) && Number.isFinite(high) && high < target) {
      errors.foodCostHighPercent = err(
        "FOOD_COST_HIGH_BELOW_TARGET",
        "High food cost threshold must be at or above your target."
      );
    }
  }

  if (body.suggestedPriceRoundingStep !== undefined && body.suggestedPriceRoundingStep !== "") {
    const step = Number(body.suggestedPriceRoundingStep);
    if (![1, 5, 10].includes(step)) {
      errors.suggestedPriceRoundingStep = err("ROUNDING_STEP", "Rounding step must be 1, 5, or 10.");
    }
  }

  if (body.suspiciousLowCostFraction !== undefined && body.suspiciousLowCostFraction !== "") {
    const f = Number(body.suspiciousLowCostFraction);
    if (!Number.isFinite(f) || f <= 0 || f > 1) {
      errors.suspiciousLowCostFraction = err(
        "SUSPICIOUS_COST_FRACTION",
        "Enter a fraction between 0 and 1 (default 0.25)."
      );
    }
  }

  for (const key of ["deliveryEstimateMin", "pickupEstimateMin"] as const) {
    if (body[key] === undefined || body[key] === "") continue;
    const n = Number(body[key]);
    if (!Number.isInteger(n) || n < 1 || n > 24 * 60) {
      errors[key] = err("MINUTES_RANGE", "Enter whole minutes between 1 and 1440.");
    }
  }

  let minimumOrder: number | undefined;
  if (body.minimumOrder !== undefined && body.minimumOrder !== "") {
    const n = Number(body.minimumOrder);
    if (!Number.isFinite(n) || n < 0) {
      errors.minimumOrder = err("MINIMUM_ORDER", "Minimum order must be zero or greater.");
    } else {
      minimumOrder = n;
    }
  }
  let freeDelivery: number | undefined;
  if (body.freeDeliveryAbove !== undefined && body.freeDeliveryAbove !== null && body.freeDeliveryAbove !== "") {
    const n = Number(body.freeDeliveryAbove);
    if (!Number.isFinite(n) || n < 0) {
      errors.freeDeliveryAbove = err("FREE_DELIVERY", "Free-delivery threshold must be zero or greater.");
    } else {
      freeDelivery = n;
    }
  }
  if (
    minimumOrder !== undefined &&
    freeDelivery !== undefined &&
    freeDelivery > 0 &&
    minimumOrder > freeDelivery
  ) {
    errors.freeDeliveryAbove = err(
      "FREE_DELIVERY_BELOW_MINIMUM",
      "Free delivery threshold should be at or above your minimum order amount."
    );
  }

  if (body.shiftVarianceTolerance !== undefined && body.shiftVarianceTolerance !== "") {
    const n = Number(body.shiftVarianceTolerance);
    if (!Number.isFinite(n) || n < 0) {
      errors.shiftVarianceTolerance = err("VARIANCE_TOLERANCE", "Variance tolerance must be zero or greater.");
    }
  }

  if (body.riderCashStaleHours !== undefined && body.riderCashStaleHours !== "") {
    const n = Number(body.riderCashStaleHours);
    if (!Number.isInteger(n) || n < 1 || n > 24 * 14) {
      errors.riderCashStaleHours = err("HOURS_RANGE", "Enter whole hours between 1 and 336.");
    }
  }

  if (body.offlineClockSkewThresholdMinutes !== undefined && body.offlineClockSkewThresholdMinutes !== "") {
    const n = Number(body.offlineClockSkewThresholdMinutes);
    if (!Number.isInteger(n) || n < 1 || n > 24 * 60) {
      errors.offlineClockSkewThresholdMinutes = err("MINUTES_RANGE", "Enter whole minutes between 1 and 1440.");
    }
  }

  if (body.maxCashierDiscountPercent !== undefined && body.maxCashierDiscountPercent !== "") {
    const n = Number(body.maxCashierDiscountPercent);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      errors.maxCashierDiscountPercent = err("PERCENT_RANGE", "Enter a percentage from 0 to 100.");
    }
  }

  if (body.analyticsEmailRecipients !== undefined) {
    const listErr = validateEmailList(String(body.analyticsEmailRecipients ?? ""));
    if (listErr) errors.analyticsEmailRecipients = listErr;
  }

  if (body.dailyCloseoutEmailRecipients !== undefined) {
    const raw = String(body.dailyCloseoutEmailRecipients ?? "").trim();
    if (raw) {
      const listErr = validateEmailList(raw);
      if (listErr) errors.dailyCloseoutEmailRecipients = listErr;
    }
  }

  if (body.weeklySchedule !== undefined && body.weeklySchedule !== null) {
    const schedule = body.weeklySchedule;
    if (typeof schedule !== "object" || Array.isArray(schedule)) {
      errors.weeklySchedule = err("WEEKLY_SCHEDULE", "Hours must be a weekly schedule.");
    } else {
      const coerced = coerceSchedule(schedule, { openHour: 0, openMinute: 0, closeHour: 23, closeMinute: 59 });
      for (const day of WEEKDAYS) {
        const row = (schedule as Record<string, { closed?: boolean; slots?: { open?: string; close?: string }[] }>)[
          day
        ];
        if (!row) continue;
        if (row.closed) continue;
        const slots = row.slots ?? [];
        if (!slots.length) errors[`hours.${day}`] = err("HOURS_SLOT", "Add a time slot or mark the day closed.");
        for (const slot of slots) {
          if (parseMinutes(String(slot.open || "")) == null || parseMinutes(String(slot.close || "")) == null) {
            errors[`hours.${day}`] = err("HOURS_TIME", "Use 24-hour times like 19:00.");
          }
        }
        if (coerced[day].slots.length !== (row.closed ? 0 : slots.length) && !errors[`hours.${day}`]) {
          errors[`hours.${day}`] = err("HOURS_SLOT_LIMIT", "Each day can have up to 3 time slots.");
        }
      }
    }
  }

  return errors;
}

export function firstSettingsErrorMessage(errors: SettingsErrors): string | undefined {
  const first = Object.values(errors)[0];
  return first?.message;
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
