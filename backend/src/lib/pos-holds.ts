import { prisma } from "./prisma";
import { cleanText } from "./text";

export const DEFAULT_POS_HOLD_HOURS = 12;

export type PosHoldPayload = Record<string, unknown>;

export function posHoldExpiry(hours = DEFAULT_POS_HOLD_HOURS) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export async function purgeExpiredPosHolds(branchId: string) {
  await prisma.posHold.deleteMany({
    where: { branchId, expiresAt: { lt: new Date() } },
  });
}

export async function createPosHold(
  branchId: string,
  createdById: string,
  payload: PosHoldPayload,
  label?: string | null,
  holdHours = DEFAULT_POS_HOLD_HOURS
) {
  await purgeExpiredPosHolds(branchId);
  return prisma.posHold.create({
    data: {
      branchId,
      createdById,
      label: label ? cleanText(label, 80) || null : null,
      payload,
      expiresAt: posHoldExpiry(holdHours),
    },
  });
}

export async function listPosHolds(branchId: string, createdById?: string) {
  await purgeExpiredPosHolds(branchId);
  return prisma.posHold.findMany({
    where: {
      branchId,
      expiresAt: { gt: new Date() },
      ...(createdById ? { createdById } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { createdBy: { select: { id: true, name: true } } },
  });
}

export async function getPosHoldForBranch(branchId: string, holdId: string) {
  const hold = await prisma.posHold.findUnique({ where: { id: holdId } });
  if (!hold || hold.branchId !== branchId) return null;
  if (hold.expiresAt <= new Date()) {
    await prisma.posHold.delete({ where: { id: holdId } });
    return null;
  }
  return hold;
}
