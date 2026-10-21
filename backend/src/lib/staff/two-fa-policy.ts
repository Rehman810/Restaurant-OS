import { Role } from "@prisma/client";

export function staffRoleRequiresTwoFa(
  role: Role,
  requireTwoFaAdminManager: boolean
): boolean {
  return requireTwoFaAdminManager && (role === Role.ADMIN || role === Role.MANAGER);
}

export function isPastTwoFaGrace(createdAt: Date, graceDays: number, now = new Date()): boolean {
  const graceEnds = new Date(createdAt);
  graceEnds.setDate(graceEnds.getDate() + Math.max(1, graceDays));
  return now > graceEnds;
}

export function loginBlockedForMissingTwoFa(input: {
  role: Role;
  totpEnabled: boolean;
  createdAt: Date;
  requireTwoFaAdminManager: boolean;
  graceDays: number;
}): boolean {
  if (!staffRoleRequiresTwoFa(input.role, input.requireTwoFaAdminManager)) return false;
  if (input.totpEnabled) return false;
  return isPastTwoFaGrace(input.createdAt, input.graceDays);
}
