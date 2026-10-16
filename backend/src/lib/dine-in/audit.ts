import { writeAudit } from "../audit";
import { AuditAction } from "../audit-actions";
import { prisma } from "../prisma";

export async function writeAuditLog(input: {
  branchId: string;
  actorId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  meta?: Record<string, unknown>;
}) {
  await writeAudit(prisma, {
    branchId: input.branchId,
    actorId: input.actorId,
    action: input.action.startsWith("dine_in.") ? AuditAction.DINE_IN_EVENT : input.action,
    entityType: input.entity,
    entityId: input.entityId,
    meta: input.meta,
    after: input.meta,
  });
}
