import { PlatformRole } from "@prisma/client";
import { basePrisma } from "../prisma-base";

export async function countActiveSuperAdmins(excludeUserId?: string) {
  return basePrisma.platformUser.count({
    where: {
      role: PlatformRole.SUPER_ADMIN,
      isActive: true,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
  });
}

export async function assertCanDemoteOrDeactivateSuperAdmin(userId: string, nextRole?: PlatformRole, deactivating?: boolean) {
  const user = await basePrisma.platformUser.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true },
  });
  if (!user || user.role !== PlatformRole.SUPER_ADMIN || !user.isActive) return;
  const losingSuper =
    deactivating || (nextRole !== undefined && nextRole !== PlatformRole.SUPER_ADMIN);
  if (!losingSuper) return;
  const others = await countActiveSuperAdmins(userId);
  if (others < 1) {
    throw Object.assign(new Error("Cannot remove or demote the last active super admin."), {
      status: 400,
      code: "LAST_SUPER_ADMIN",
    });
  }
}
