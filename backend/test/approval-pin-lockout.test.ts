import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { setApprovalPin, verifyApprovalPin, PIN_FAIL_LIMIT } from "../src/lib/approval-pin";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("[APR-02] approval PIN lockout", () => {
  it("locks after repeated wrong PIN attempts", async () => {
    const manager = await prisma.user.findFirst({
      where: { role: Role.MANAGER, isActive: true },
      select: { id: true },
    });
    if (!manager) return;
    await setApprovalPin(manager.id, "424242");
    for (let i = 0; i < PIN_FAIL_LIMIT; i++) {
      const r = await verifyApprovalPin(manager.id, "000000", { requesterId: manager.id });
      expect(r.ok).toBe(false);
    }
    const locked = await verifyApprovalPin(manager.id, "424242", { requesterId: manager.id });
    expect(locked.ok).toBe(false);
    if (locked.ok === false) expect(locked.code).toBe("APPROVAL_LOCKED");
    await prisma.user.update({
      where: { id: manager.id },
      data: { approvalPinFailedCount: 0, approvalPinLockedUntil: null },
    });
    await setApprovalPin(manager.id, "424242");
  });

  it("accepts correct PIN after reset", async () => {
    const admin = await prisma.user.findFirst({
      where: { role: Role.ADMIN, isActive: true },
      select: { id: true },
    });
    if (!admin) return;
    await setApprovalPin(admin.id, "9999");
    const ok = await verifyApprovalPin(admin.id, "9999", { requesterId: admin.id });
    expect(ok.ok).toBe(true);
  });
});
