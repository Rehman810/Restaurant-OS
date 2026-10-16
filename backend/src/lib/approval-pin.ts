import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { isLocked, LOCK_MS } from "./login-guard";
import { writeAudit } from "./audit";
import { AuditAction } from "./audit-actions";

export const APPROVAL_PIN_ROLES: Role[] = [Role.ADMIN, Role.MANAGER];
export const PIN_FAIL_LIMIT = 5;
export const APPROVAL_LOCKED_ERROR = "Approval PIN locked. Try again in 15 minutes.";
export const APPROVAL_INVALID_ERROR = "Invalid approval PIN.";
export const APPROVAL_REQUIRED_ERROR = "Manager approval is required.";
export const APPROVAL_REQUIRED_CODE = "APPROVAL_REQUIRED";

const PIN_RE = /^\d{4,6}$/;

export function isValidPinFormat(pin: string) {
  return PIN_RE.test(pin);
}

export async function hashApprovalPin(pin: string) {
  return bcrypt.hash(pin, 12);
}

export async function setApprovalPin(userId: string, pin: string) {
  if (!isValidPinFormat(pin)) {
    throw Object.assign(new Error("PIN must be 4–6 digits."), { status: 400 });
  }
  const hash = await hashApprovalPin(pin);
  await prisma.user.update({
    where: { id: userId },
    data: {
      approvalPinHash: hash,
      approvalPinFailedCount: 0,
      approvalPinLockedUntil: null,
    },
  });
}

type PinUser = {
  id: string;
  role: Role;
  isActive: boolean;
  approvalPinHash: string | null;
  approvalPinFailedCount: number;
  approvalPinLockedUntil: Date | null;
  name: string;
};

export async function verifyApprovalPin(
  approverId: string,
  pin: string,
  auditMeta?: { ip?: string; requesterId?: string }
): Promise<{ ok: true; approver: PinUser } | { ok: false; status: number; error: string; code?: string }> {
  const approver = await prisma.user.findUnique({ where: { id: approverId } });
  if (!approver || !approver.isActive || !APPROVAL_PIN_ROLES.includes(approver.role)) {
    return { ok: false, status: 403, error: APPROVAL_INVALID_ERROR, code: "INVALID_APPROVER" };
  }
  if (isLocked(approver.approvalPinLockedUntil)) {
    return { ok: false, status: 429, error: APPROVAL_LOCKED_ERROR, code: "APPROVAL_LOCKED" };
  }
  if (!approver.approvalPinHash) {
    return { ok: false, status: 403, error: "Approver has no PIN set.", code: "NO_PIN" };
  }
  if (!isValidPinFormat(pin)) {
    return { ok: false, status: 400, error: "PIN must be 4–6 digits.", code: "INVALID_PIN_FORMAT" };
  }

  const match = await bcrypt.compare(pin, approver.approvalPinHash);
  if (!match) {
    const nextCount = approver.approvalPinFailedCount + 1;
    const data =
      nextCount >= PIN_FAIL_LIMIT
        ? {
            approvalPinFailedCount: nextCount,
            approvalPinLockedUntil: new Date(Date.now() + LOCK_MS),
          }
        : { approvalPinFailedCount: nextCount, approvalPinLockedUntil: null };
    await prisma.user.update({ where: { id: approver.id }, data });
    await writeAudit(prisma, {
      actorId: auditMeta?.requesterId ?? null,
      action: AuditAction.APPROVAL_PIN_FAILED,
      entityType: "user",
      entityId: approver.id,
      ip: auditMeta?.ip ?? null,
    });
    if (data.approvalPinLockedUntil) {
      return { ok: false, status: 429, error: APPROVAL_LOCKED_ERROR, code: "APPROVAL_LOCKED" };
    }
    return { ok: false, status: 403, error: APPROVAL_INVALID_ERROR, code: "INVALID_PIN" };
  }

  await prisma.user.update({
    where: { id: approver.id },
    data: { approvalPinFailedCount: 0, approvalPinLockedUntil: null },
  });
  return { ok: true, approver };
}

export function managerActsDirectly(role: Role) {
  return APPROVAL_PIN_ROLES.includes(role);
}
