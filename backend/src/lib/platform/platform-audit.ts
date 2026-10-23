import { Prisma, PlatformRole } from "@prisma/client";
import { basePrisma } from "../prisma-base";
import { withoutTenant } from "../restaurant-context";

export type WritePlatformAuditInput = {
  actorId?: string | null;
  actorEmail?: string;
  action: string;
  entityType: string;
  entityId: string;
  subjectTenantId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
};

export async function writePlatformAudit(input: WritePlatformAuditInput) {
  const row = await withoutTenant("platform audit log", () =>
    basePrisma.platformAuditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorEmail: input.actorEmail?.trim() || "",
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        subjectTenantId: input.subjectTenantId ?? null,
        before: input.before === undefined ? undefined : (input.before as Prisma.InputJsonValue),
        after: input.after === undefined ? undefined : (input.after as Prisma.InputJsonValue),
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    })
  );
  void import("./platform-alerts").then(({ dispatchPlatformAlerts }) =>
    dispatchPlatformAlerts({
      action: input.action,
      actorEmail: input.actorEmail,
      subjectTenantId: input.subjectTenantId,
    })
  );
  return row;
}

export type PlatformActor = {
  id: string;
  email: string;
  name: string;
  role: PlatformRole;
};
