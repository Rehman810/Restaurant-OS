import type { BranchScope } from "./branch-scope";
import { auditActionsByCategory } from "./audit-actions";
import {
  AUDIT_SENSITIVE_KITCHEN_STATUSES,
  AUDIT_SHIFT_VARIANCE_SENSITIVE_THRESHOLD,
} from "./audit-sensitive";
import { AuditAction } from "./audit-actions";
import type { AuditLogListFilters } from "./audit-enrich";

export type { AuditLogListFilters };

export function actionCodesForCategory(category: string): string[] {
  const grouped = auditActionsByCategory();
  const key = category as keyof typeof grouped;
  if (!grouped[key]) return [];
  return grouped[key].map((a) => a.code);
}

export function buildSensitiveOnlyWhere(): Record<string, unknown> {
  const kitchenStatuses = [...AUDIT_SENSITIVE_KITCHEN_STATUSES];
  return {
    OR: [
      {
        action: {
          in: [
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
          ],
        },
      },
      {
        action: { in: [AuditAction.ORDER_CANCELLED, AuditAction.ORDER_VOIDED, "ORDER_CANCELLED", "ORDER_VOIDED"] },
        OR: kitchenStatuses.map((status) => ({
          before: { path: ["status"], equals: status },
        })),
      },
      {
        action: { in: [AuditAction.ORDER_STATUS_CHANGED, "ORDER_STATUS_CHANGED"] },
        after: { path: ["kotPrint"], equals: true },
      },
      {
        action: { in: [AuditAction.ITEM_PRICE_CHANGED, "ITEM_PRICE_CHANGED"] },
        entityType: "order",
        after: { path: ["priceOverride"], equals: true },
      },
      {
        action: { in: [AuditAction.SHIFT_CLOSED, "SHIFT_CLOSED"] },
        OR: [
          { after: { path: ["variance"], gte: AUDIT_SHIFT_VARIANCE_SENSITIVE_THRESHOLD } },
          { after: { path: ["variance"], lte: -AUDIT_SHIFT_VARIANCE_SENSITIVE_THRESHOLD } },
        ],
      },
    ],
  };
}

export function buildAuditLogWhere(scope: BranchScope, filters: AuditLogListFilters) {
  const and: Record<string, unknown>[] = [];

  if (!scope.allBranches) {
    and.push({ branchId: scope.branchId });
  } else if (filters.branchId) {
    and.push({ branchId: filters.branchId });
  }

  if (filters.action) and.push({ action: filters.action });
  if (filters.category) {
    const codes = actionCodesForCategory(filters.category);
    if (codes.length) and.push({ action: { in: codes } });
  }
  if (filters.actorId) and.push({ actorId: filters.actorId });
  if (filters.entityType) and.push({ entityType: filters.entityType });
  if (filters.entityId) and.push({ entityId: filters.entityId });

  if (filters.from || filters.to) {
    and.push({
      createdAt: {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      },
    });
  }

  if (filters.search?.trim()) {
    const q = filters.search.trim();
    and.push({
      OR: [
        { entityLabel: { contains: q, mode: "insensitive" } },
        { entityId: { contains: q, mode: "insensitive" } },
        { action: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (filters.sensitiveOnly) {
    and.push(buildSensitiveOnlyWhere());
  }

  if (and.length === 0) return {};
  if (and.length === 1) return and[0];
  return { AND: and };
}

export function parseAuditListQuery(query: Record<string, unknown>) {
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
  const offset = Math.max(0, Number(query.offset) || 0);
  const action = typeof query.action === "string" ? query.action.trim() : "";
  const category = typeof query.category === "string" ? query.category.trim() : "";
  const actorId = typeof query.actorId === "string" ? query.actorId.trim() : "";
  const entityType = typeof query.entityType === "string" ? query.entityType.trim() : "";
  const entityId = typeof query.entityId === "string" ? query.entityId.trim() : "";
  const branchFilter = typeof query.branchId === "string" ? query.branchId.trim() : "";
  const search = typeof query.search === "string" ? query.search.trim() : "";
  const sensitiveOnly = query.sensitiveOnly === "1" || query.sensitiveOnly === "true";
  const from = parseDate(query.from);
  const to = parseDate(query.to);
  return {
    limit,
    offset,
    filters: {
      action,
      category,
      actorId,
      entityType,
      entityId,
      branchId: branchFilter,
      search,
      from,
      to,
      sensitiveOnly,
    },
  };
}

function parseDate(v: unknown) {
  if (!v || typeof v !== "string") return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
