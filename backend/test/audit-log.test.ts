import { describe, expect, it } from "vitest";
import { writeAudit } from "../src/lib/audit";
import { AuditAction } from "../src/lib/audit-actions";
import { prisma } from "../src/lib/prisma";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("[AUD-01] writeAudit", () => {
  it("persists an audit row", async () => {
    const row = await prisma.$transaction(async (tx) => {
      await writeAudit(tx, {
        action: AuditAction.SETTINGS_CHANGED,
        entityType: "test",
        entityId: "test-entity",
        before: { a: 1 },
        after: { a: 2 },
      });
      return tx.auditLog.findFirst({
        where: { entityId: "test-entity", action: AuditAction.SETTINGS_CHANGED },
        orderBy: { createdAt: "desc" },
      });
    });
    expect(row).toBeTruthy();
    expect(row?.entityType).toBe("test");
    if (row) await prisma.auditLog.delete({ where: { id: row.id } });
  });

  it("rolls back parent transaction when audit insert fails", async () => {
    const marker = `Audit rollback ${Date.now()}`;
    await expect(
      prisma.$transaction(async (tx) => {
        const item = await tx.inventoryItem.create({
          data: { name: marker, unit: "PIECE", trackStock: false },
        });
        await writeAudit(
          {
            auditLog: {
              create: () => Promise.reject(new Error("audit fail")),
            },
          },
          {
            action: AuditAction.ITEM_PRICE_CHANGED,
            entityType: "menu_item",
            entityId: item.id,
          }
        );
        return item;
      })
    ).rejects.toThrow("audit fail");
    const leaked = await prisma.inventoryItem.findFirst({ where: { name: marker } });
    expect(leaked).toBeNull();
  });
});
