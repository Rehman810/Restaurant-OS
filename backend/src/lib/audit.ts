import { Prisma, Role } from "@prisma/client";

/** Minimal client surface so extended Prisma + transaction clients both type-check. */
export type AuditDb = {
  auditLog: {
    create: (args: Prisma.AuditLogCreateArgs) => Promise<{ id: string }>;
  };
};

export type WriteAuditInput = {
  actorId?: string | null;
  actorRole?: Role | null;
  branchId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  ip?: string | null;
  /** Legacy dine-in payloads */
  meta?: Record<string, unknown>;
};

export async function writeAudit(db: AuditDb, input: WriteAuditInput) {
  await db.auditLog.create({
    data: {
      branchId: input.branchId ?? null,
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: input.before === undefined ? undefined : (input.before as Prisma.InputJsonValue),
      after: input.after === undefined ? undefined : (input.after as Prisma.InputJsonValue),
      reason: input.reason ?? null,
      ip: input.ip ?? null,
      meta: input.meta === undefined ? undefined : (input.meta as Prisma.InputJsonValue),
    },
  });
}

/** Pick safe settings fields for audit diffs (never secrets). */
export function settingsSnapshotForAudit(row: Record<string, unknown>) {
  const omit = new Set(["id", "restaurantId", "updatedAt"]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (omit.has(k)) continue;
    out[k] = v;
  }
  return out;
}

export function diffSettingsKeys(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  touchedKeys: string[]
) {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const key of touchedKeys) {
    if (before[key] !== undefined || after[key] !== undefined) {
      b[key] = before[key];
      a[key] = after[key];
    }
  }
  return { before: b, after: a };
}
