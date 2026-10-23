import { describe, expect, it } from "vitest";
import { PlatformRole } from "@prisma/client";
import { assertCanDemoteOrDeactivateSuperAdmin } from "../src/lib/platform/platform-users-guard";
import { basePrisma } from "../src/lib/prisma-base";
import bcrypt from "bcryptjs";

const hasDb = Boolean(process.env.DATABASE_URL?.includes("test"));

describe.skipIf(!hasDb)("platform users guard", () => {
  it("prevents deactivating the only super admin", async () => {
    const email = `solo-super-${Date.now()}@test.local`;
    const hash = await bcrypt.hash("platform-test-pass-12", 10);
    const user = await basePrisma.platformUser.create({
      data: { email, name: "Solo", passwordHash: hash, role: PlatformRole.SUPER_ADMIN },
    });
    const others = await basePrisma.platformUser.count({
      where: { role: PlatformRole.SUPER_ADMIN, isActive: true, id: { not: user.id } },
    });
    if (others > 0) return;
    await expect(assertCanDemoteOrDeactivateSuperAdmin(user.id, undefined, true)).rejects.toMatchObject({
      code: "LAST_SUPER_ADMIN",
    });
  });
});
