import { prisma } from "../../src/lib/prisma";
import { ensureDefaultBranch } from "../../src/lib/branch-scope";

export async function ensureBranchMember(userId: string, branchId?: string) {
  const branch = branchId || (await ensureDefaultBranch());
  await prisma.branchMember.upsert({
    where: { branchId_userId: { branchId: branch, userId } },
    create: { branchId: branch, userId },
    update: {},
  });
  return branch;
}
