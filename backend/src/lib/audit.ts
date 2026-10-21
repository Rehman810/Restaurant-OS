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
  entityLabel?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
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
      entityLabel: input.entityLabel?.trim() || null,
      before: input.before === undefined ? undefined : (input.before as Prisma.InputJsonValue),
      after: input.after === undefined ? undefined : (input.after as Prisma.InputJsonValue),
      reason: input.reason ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      meta: input.meta === undefined ? undefined : (input.meta as Prisma.InputJsonValue),
    },
  });
}

/** Log audit failures without throwing (use outside transactions or when business action must succeed). */
export async function writeAuditSafe(db: AuditDb, input: WriteAuditInput) {
  try {
    await writeAudit(db, input);
  } catch (err) {
    console.error("[audit] write failed", err instanceof Error ? err.message : err, {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
    });
  }
}

const SETTINGS_AUDIT_OMIT = new Set(["id", "restaurantId", "updatedAt", "settingsVersion"]);

const SETTINGS_AUDIT_REDACT = /(secret|password|pin|hash|token|apikey|api_key|vapid)/i;

/** Pick safe settings fields for audit diffs (never secrets). */
export function settingsSnapshotForAudit(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (SETTINGS_AUDIT_OMIT.has(k)) continue;
    if (SETTINGS_AUDIT_REDACT.test(k)) {
      out[k] = "[redacted]";
      continue;
    }
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
    const bv = before[key];
    const av = after[key];
    if (JSON.stringify(bv) === JSON.stringify(av)) continue;
    b[key] = bv;
    a[key] = av;
  }
  return { before: b, after: a };
}

/** Normalize order status audit payloads to { from, to } for new writes. */
export function orderStatusAuditPayload(beforeStatus: string, afterStatus: string, extra?: Record<string, unknown>) {
  return {
    before: { from: beforeStatus, status: beforeStatus },
    after: { to: afterStatus, status: afterStatus, ...extra },
  };
}
