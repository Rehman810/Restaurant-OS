import { AuditAction, resolveAuditActionMeta } from "./audit-actions";

/** Cancel/void after kitchen has started (PREPARING ≈ Cooking in UI). */
export const AUDIT_SENSITIVE_KITCHEN_STATUSES = new Set(["PREPARING", "READY"]);

/** Shift close variance at or above this amount (currency units) is sensitive. */
export const AUDIT_SHIFT_VARIANCE_SENSITIVE_THRESHOLD = 500;

const ALWAYS_SENSITIVE_ACTIONS = new Set<string>([
  AuditAction.REFUND_ISSUED,
  AuditAction.DISCOUNT_APPLIED,
  AuditAction.ORDER_PRICE_OVERRIDE,
  AuditAction.ORDER_KOT_REPRINTED,
  AuditAction.ORDER_RECEIPT_REPRINTED,
  AuditAction.CUSTOMER_BLOCKED,
  AuditAction.STAFF_ROLE_CHANGED,
  AuditAction.ITEM_PRICE_CHANGED,
  "REFUND_ISSUED",
  "DISCOUNT_APPLIED",
  "CUSTOMER_BLOCKED",
  "STAFF_ROLE_CHANGED",
  "ITEM_PRICE_CHANGED",
]);

const CANCEL_ACTIONS = new Set<string>([
  AuditAction.ORDER_CANCELLED,
  AuditAction.ORDER_VOIDED,
  "ORDER_CANCELLED",
  "ORDER_VOIDED",
]);

const SHIFT_CLOSED_ACTIONS = new Set<string>([AuditAction.SHIFT_CLOSED, "SHIFT_CLOSED"]);

function jsonRecord(v: unknown): Record<string, unknown> | null {
  if (v == null || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function statusFromBefore(before: unknown): string | null {
  const b = jsonRecord(before);
  if (!b) return null;
  if (typeof b.status === "string") return b.status;
  if (typeof b.from === "string") return b.from;
  return null;
}

function varianceFromAfter(after: unknown): number | null {
  const a = jsonRecord(after);
  if (!a || a.variance == null) return null;
  const n = Number(a.variance);
  return Number.isFinite(n) ? n : null;
}

/** Legacy KOT reprint logged as order status with kotPrint in after. */
function isLegacyKotReprint(action: string, after: unknown): boolean {
  if (action !== AuditAction.ORDER_STATUS_CHANGED && action !== "ORDER_STATUS_CHANGED") return false;
  const a = jsonRecord(after);
  return Boolean(a?.kotPrint);
}

/** Legacy POS price override on order entity. */
function isLegacyOrderPriceOverride(action: string, entityType: string, after: unknown): boolean {
  if (entityType !== "order") return false;
  if (action !== AuditAction.ITEM_PRICE_CHANGED && action !== "ITEM_PRICE_CHANGED") return false;
  const a = jsonRecord(after);
  return Boolean(a?.priceOverride);
}

export function isAuditLogSensitive(input: {
  action: string;
  entityType: string;
  before?: unknown;
  after?: unknown;
}): boolean {
  const { action, entityType, before, after } = input;
  if (ALWAYS_SENSITIVE_ACTIONS.has(action)) return true;
  if (isLegacyKotReprint(action, after)) return true;
  if (isLegacyOrderPriceOverride(action, entityType, after)) return true;

  if (CANCEL_ACTIONS.has(action)) {
    const from = statusFromBefore(before);
    if (from && AUDIT_SENSITIVE_KITCHEN_STATUSES.has(from)) return true;
  }

  if (SHIFT_CLOSED_ACTIONS.has(action)) {
    const variance = varianceFromAfter(after);
    if (variance != null && Math.abs(variance) >= AUDIT_SHIFT_VARIANCE_SENSITIVE_THRESHOLD) {
      return true;
    }
  }

  return false;
}

export function sensitiveActionCodesForFilter(): string[] {
  return [
    ...ALWAYS_SENSITIVE_ACTIONS,
    ...CANCEL_ACTIONS,
    ...SHIFT_CLOSED_ACTIONS,
    AuditAction.ORDER_STATUS_CHANGED,
    "ORDER_STATUS_CHANGED",
  ];
}
