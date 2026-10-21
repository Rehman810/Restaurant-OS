import { writeAudit } from "../audit";
import { AuditAction } from "../audit-actions";
import { prisma } from "../prisma";

const LEGACY_TO_CANONICAL: Record<string, string> = {
  "reservation.confirm": AuditAction.RESERVATION_CONFIRMED,
  "reservation.reject": AuditAction.RESERVATION_REJECTED,
  "reservation.seat": AuditAction.RESERVATION_SEATED,
  "table.walk_in_seat": AuditAction.RESERVATION_SEATED,
  "reservation.no_show_auto": AuditAction.RESERVATION_NO_SHOW_AUTO,
  "reservation.expired_unconfirmed": AuditAction.RESERVATION_EXPIRED_UNCONFIRMED,
  WAITLIST_ADD: AuditAction.WAITLIST_ADDED,
  WAITLIST_SEATED: AuditAction.WAITLIST_SEATED,
};

function resolveAction(action: string) {
  if (action.startsWith("dine_in.")) return AuditAction.DINE_IN_EVENT;
  return LEGACY_TO_CANONICAL[action] ?? action;
}

export async function writeAuditLog(input: {
  branchId: string;
  actorId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  entityLabel?: string | null;
  meta?: Record<string, unknown>;
}) {
  await writeAudit(prisma, {
    branchId: input.branchId,
    actorId: input.actorId,
    action: resolveAction(input.action),
    entityType: input.entity,
    entityId: input.entityId,
    entityLabel: input.entityLabel,
    meta: input.meta,
    after: input.meta,
  });
}
