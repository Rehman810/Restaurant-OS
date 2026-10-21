import { prisma } from "../../src/lib/prisma";

const createdUserIds: string[] = [];

export function registerTestUserId(id: string): void {
  createdUserIds.push(id);
}

export async function cleanupRegisteredTestUsers(): Promise<void> {
  const ids = [...new Set(createdUserIds)];
  createdUserIds.length = 0;
  if (!ids.length) return;

  for (const id of ids) {
    await prisma.branchMember.deleteMany({ where: { userId: id } });
    const deleted = await prisma.user.delete({ where: { id } }).catch(() => null);
    if (!deleted) {
      await prisma.user
        .update({ where: { id }, data: { isActive: false, tokenVersion: { increment: 1 } } })
        .catch(() => {});
    }
  }
}
