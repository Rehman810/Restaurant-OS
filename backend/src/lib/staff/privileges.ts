import { Role } from "@prisma/client";
import type { AuthUser } from "../../middleware/auth";
import { prisma } from "../prisma";

export const ASSIGNABLE_STAFF_ROLES: Role[] = [
  Role.MANAGER,
  Role.WAITER,
  Role.CHEF,
  Role.RIDER,
  Role.CASHIER,
];

export type StaffTarget = {
  id: string;
  role: Role;
  isActive: boolean;
  isOwner: boolean;
  isTest: boolean;
};

export function canAccessStaffDirectory(actor: AuthUser): boolean {
  return actor.role === Role.ADMIN || actor.role === Role.MANAGER;
}

export function canViewTestStaff(actor: AuthUser): boolean {
  return actor.role === Role.ADMIN;
}

export async function loadActorFlags(actorId: string): Promise<{ isOwner: boolean; role: Role }> {
  const row = await prisma.user.findUnique({
    where: { id: actorId },
    select: { isOwner: true, role: true },
  });
  return { isOwner: Boolean(row?.isOwner), role: row?.role ?? Role.CUSTOMER };
}

export function canCreateRole(actor: AuthUser, actorIsOwner: boolean, targetRole: Role): string | null {
  if (!canAccessStaffDirectory(actor)) return "You do not have permission to manage staff.";
  if (targetRole === Role.ADMIN) {
    if (!actorIsOwner) return "Only the store owner can create admin accounts.";
    return null;
  }
  if (!ASSIGNABLE_STAFF_ROLES.includes(targetRole)) return "Invalid staff role.";
  if (actor.role === Role.MANAGER) {
    if (targetRole === Role.MANAGER) return "Managers cannot create other manager accounts.";
    return null;
  }
  if (actor.role === Role.ADMIN) return null;
  return "You do not have permission to create staff.";
}

export function canEditTarget(
  actor: AuthUser,
  actorIsOwner: boolean,
  target: StaffTarget
): string | null {
  if (!canAccessStaffDirectory(actor)) return "You do not have permission to manage staff.";
  if (target.id === actor.id) return null;
  if (actor.role === Role.MANAGER) {
    if (target.role === Role.ADMIN || target.isOwner) {
      return "Managers cannot edit admin or owner accounts.";
    }
    if (target.role === Role.MANAGER) return "Managers cannot edit other managers.";
  }
  if (target.isOwner && !actorIsOwner) return "Only the store owner can change this account.";
  return null;
}

export function canChangeRole(
  actor: AuthUser,
  actorIsOwner: boolean,
  target: StaffTarget,
  newRole: Role
): string | null {
  const editErr = canEditTarget(actor, actorIsOwner, target);
  if (editErr) return editErr;
  if (target.id === actor.id) return "You cannot change your own role.";
  if (target.isOwner) return "The owner role cannot be reassigned.";
  if (newRole === Role.ADMIN) {
    if (!actorIsOwner) return "Only the store owner can promote someone to admin.";
  }
  if (target.role === Role.ADMIN && newRole !== Role.ADMIN && !actorIsOwner) {
    return "Only the store owner can change an admin role.";
  }
  if (newRole === Role.ADMIN) return null;
  if (!ASSIGNABLE_STAFF_ROLES.includes(newRole)) return "Invalid staff role.";
  if (actor.role === Role.MANAGER && newRole === Role.MANAGER) {
    return "Managers cannot assign the manager role.";
  }
  return null;
}

export async function assertNotLastActiveAdmin(target: StaffTarget, nextActive: boolean, nextRole: Role): Promise<string | null> {
  const demotingAdmin =
    target.role === Role.ADMIN &&
    (nextRole !== Role.ADMIN || !nextActive);
  if (!demotingAdmin || !target.isActive) return null;

  const others = await prisma.user.count({
    where: {
      role: Role.ADMIN,
      isActive: true,
      isTest: false,
      id: { not: target.id },
    },
  });
  if (others === 0) return "Keep at least one active admin account.";
  return null;
}

export function canRevokeSessions(actor: AuthUser, actorIsOwner: boolean, target: StaffTarget): string | null {
  if (actor.role !== Role.ADMIN) return "Only admins can revoke sessions.";
  return canEditTarget(actor, actorIsOwner, target);
}

export function canResetTwoFa(actor: AuthUser, actorIsOwner: boolean, target: StaffTarget): string | null {
  if (actor.role !== Role.ADMIN) return "Only admins can reset two-factor authentication.";
  return canEditTarget(actor, actorIsOwner, target);
}

export function canResetPassword(actor: AuthUser, actorIsOwner: boolean, target: StaffTarget): string | null {
  return canEditTarget(actor, actorIsOwner, target);
}

export function canSetApprovalPin(actor: AuthUser, actorIsOwner: boolean, target: StaffTarget): string | null {
  if (actor.role !== Role.ADMIN && actor.id !== target.id) {
    return "Only admins can set another user's approval PIN.";
  }
  return canEditTarget(actor, actorIsOwner, target);
}
