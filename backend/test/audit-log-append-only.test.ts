import { describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma";
import { writeAudit } from "../src/lib/audit";
import { AuditAction } from "../src/lib/audit-actions";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("AuditLog append-only", () => {
  it("rejects UPDATE and DELETE", async () => {
    const row = await prisma.auditLog.create({
      data: {
        action: AuditAction.SETTINGS_CHANGED,
        entityType: "test_append_only",
        entityId: `append-only-${Date.now()}`,
      },
    });
    await expect(
      prisma.auditLog.update({ where: { id: row.id }, data: { reason: "nope" } })
    ).rejects.toThrow(/append-only/i);
    await prisma.auditLog.update({ where: { id: row.id }, data: { branchId: null } });
    await expect(prisma.auditLog.delete({ where: { id: row.id } })).rejects.toThrow(/append-only/i);
  });
});
