import type { BranchScope } from "./branch-scope";

export type AuditLogListFilters = {
  action?: string;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  branchId?: string;
  from?: Date;
  to?: Date;
};

export function buildAuditLogWhere(scope: BranchScope, filters: AuditLogListFilters) {
  const where: Record<string, unknown> = {};
  if (!scope.allBranches) {
    where.branchId = scope.branchId;
  } else if (filters.branchId) {
    where.branchId = filters.branchId;
  }
  if (filters.action) where.action = filters.action;
  if (filters.actorId) where.actorId = filters.actorId;
  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.entityId) where.entityId = filters.entityId;
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }
  return where;
}
