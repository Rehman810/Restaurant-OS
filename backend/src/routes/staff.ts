import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  branchScopeError,
  getDefaultBranchId,
  resolveBranchScope,
  syncUserBranches,
} from "../lib/branch-scope";
import { requireAuth, requireRole } from "../middleware/auth";
import { writeAudit } from "../lib/audit";
import { AuditAction } from "../lib/audit-actions";
import { clientIp } from "../lib/client-ip";
import { sendStaffInviteEmail, sendStaffWelcomeEmail } from "../lib/email";
import { STAFF_DIRECTORY_ROLES } from "../lib/roles";
import { APPROVAL_PIN_ROLES, isValidPinFormat, setApprovalPin } from "../lib/approval-pin";
import { getStoreSettings } from "../lib/settings-data";
import { clientAppUrl } from "../lib/client-app-url";
import {
  ASSIGNABLE_STAFF_ROLES,
  assertNotLastActiveAdmin,
  canAccessStaffDirectory,
  canChangeRole,
  canCreateRole,
  canEditTarget,
  canResetPassword,
  canResetTwoFa,
  canRevokeSessions,
  canSetApprovalPin,
  canViewTestStaff,
  loadActorFlags,
  type StaffTarget,
} from "../lib/staff/privileges";
import {
  aggregateStaffTiles,
  buildStaffWhere,
  parseStaffListQuery,
  staffOrderBy,
} from "../lib/staff/list-query";
import {
  accessSummary,
  displayNameFromUser,
  maskIp,
  maskPhone,
  twoFaCompliance,
} from "../lib/staff/serialize";
import { validatePasswordPolicy } from "../lib/staff/password-policy";
import { staffPermissionsSummary } from "../lib/staff/permissions-summary";
import { assertCanAddStaff, EntitlementError } from "../lib/platform/entitlements";

export const staffRouter = Router();

const STAFF_ROLES = STAFF_DIRECTORY_ROLES;

function requireStaffDirectory(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  if (!req.user || !canAccessStaffDirectory(req.user)) {
    return res.status(403).json({ error: "You do not have access to staff management." });
  }
  next();
}

function generateStaffPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) out += chars[bytes[i] % chars.length];
  return out;
}

function toTarget(user: {
  id: string;
  role: Role;
  isActive: boolean;
  isOwner: boolean;
  isTest: boolean;
}): StaffTarget {
  return {
    id: user.id,
    role: user.role,
    isActive: user.isActive,
    isOwner: user.isOwner,
    isTest: user.isTest,
  };
}

async function branchNamesForUsers(userIds: string[]): Promise<Map<string, string[]>> {
  if (!userIds.length) return new Map();
  const rows = await prisma.branchMember.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, branch: { select: { name: true } } },
  });
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(row.userId) ?? [];
    list.push(row.branch.name);
    map.set(row.userId, list);
  }
  return map;
}

async function assertManagerBranches(actorId: string, branchIds: string[]) {
  const allowed = await prisma.branchMember.findMany({
    where: { userId: actorId },
    select: { branchId: true },
  });
  const set = new Set(allowed.map((r) => r.branchId));
  if (!branchIds.every((id) => set.has(id))) {
    throw Object.assign(new Error("You can only assign branches you manage."), { status: 403 });
  }
}

staffRouter.get("/permissions", requireAuth, requireStaffDirectory, (_req, res) => {
  res.json({ roles: staffPermissionsSummary() });
});

staffRouter.get("/", requireAuth, requireStaffDirectory, async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }

  const filters = parseStaffListQuery(req.query as Record<string, unknown>);
  if (filters.includeTest && !canViewTestStaff(req.user!)) {
    return res.status(403).json({ error: "Only admins can include test accounts." });
  }

  const settings = await getStoreSettings();
  const inactivityDays = settings.staffInactivityDays ?? 90;
  const requireTwoFa = Boolean(settings.staffRequireTwoFaAdminManager);
  const graceDays = settings.twoFaReminderDays ?? 7;

  const where = buildStaffWhere(scope, req.user!.role, filters, inactivityDays);
  const orderBy = staffOrderBy(filters.sort, filters.order);

  const [rows, total, tiles] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        isTest: true,
        isOwner: true,
        totpEnabled: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy,
      take: filters.pageSize,
      skip: filters.offset,
    }),
    prisma.user.count({ where }),
    aggregateStaffTiles(where, requireTwoFa, graceDays),
  ]);

  const branchMembers = rows.length
    ? await prisma.branchMember.findMany({
        where: { userId: { in: rows.map((r) => r.id) } },
        select: { userId: true, branchId: true },
      })
    : [];
  const branchIdsByUser = new Map<string, string[]>();
  for (const row of branchMembers) {
    const list = branchIdsByUser.get(row.userId) ?? [];
    list.push(row.branchId);
    branchIdsByUser.set(row.userId, list);
  }
  const branchNames = await branchNamesForUsers(rows.map((r) => r.id));
  const viewer = req.user!;

  res.json({
    staff: rows.map((s) => {
      const names = branchNames.get(s.id) ?? [];
      const compliance = twoFaCompliance({
        role: s.role,
        totpEnabled: s.totpEnabled,
        createdAt: s.createdAt,
        requireTwoFa,
        graceDays,
      });
      return {
        id: s.id,
        displayName: displayNameFromUser(s),
        name: s.name,
        email: s.email,
        phone: maskPhone(s.phone, viewer, s.role),
        role: s.role,
        branches: names,
        branchIds: branchIdsByUser.get(s.id) ?? [],
        status: s.isActive ? "active" : "inactive",
        isActive: s.isActive,
        twoFaEnabled: s.totpEnabled,
        twoFaCompliant: compliance.compliant,
        twoFaRequired: compliance.required,
        twoFaGraceEndsAt: compliance.graceEndsAt,
        createdAt: s.createdAt,
        lastActiveAt: s.lastLoginAt,
        isOwner: s.isOwner,
        accessSummary: accessSummary({ role: s.role, isOwner: s.isOwner, branchNames: names }),
        isTest: viewer.role === Role.ADMIN ? s.isTest : undefined,
      };
    }),
    total,
    page: Math.floor(filters.offset / filters.pageSize) + 1,
    pageSize: filters.pageSize,
    offset: filters.offset,
    limit: filters.pageSize,
    counts: tiles,
    stats: {
      total: tiles.total,
      chefs: tiles.chefs,
      riders: tiles.riders,
      active: tiles.total - tiles.inactive,
    },
  });
});

staffRouter.post("/", requireAuth, requireStaffDirectory, async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }

  const actor = req.user!;
  const actorFlags = await loadActorFlags(actor.id);
  const settings = await getStoreSettings();
  const minPassword = settings.passwordMinLength ?? 8;

  const { name, email, phone, password, role, autoGeneratePassword, branchIds, sendInvite } = req.body as {
    name?: string;
    email?: string;
    phone?: string;
    password?: string;
    role?: Role;
    autoGeneratePassword?: boolean;
    branchIds?: string[];
    sendInvite?: boolean;
  };

  if (!name?.trim() || !email?.trim()) {
    return res.status(400).json({ error: "Name and email are required." });
  }
  if (!role) return res.status(400).json({ error: "Role is required." });

  const createErr = canCreateRole(actor, actorFlags.isOwner, role);
  if (createErr) return res.status(403).json({ error: createErr });

  try {
    await assertCanAddStaff();
  } catch (err) {
    if (err instanceof EntitlementError) {
      return res.status(403).json({ error: err.message, code: err.code });
    }
    throw err;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.user.findFirst({ where: { email: normalizedEmail } });
  if (existing) return res.status(409).json({ error: "An account with this email already exists." });

  const useInvite = sendInvite !== false;
  let plainPassword: string | undefined;
  let passwordHash: string;
  let inviteToken: string | null = null;
  let inviteExpires: Date | null = null;

  if (useInvite) {
    inviteToken = crypto.randomBytes(32).toString("hex");
    inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
  } else {
    const generated = Boolean(autoGeneratePassword);
    plainPassword = password?.trim() || generateStaffPassword();
    const policyErr = validatePasswordPolicy(plainPassword, minPassword);
    if (policyErr) return res.status(400).json({ error: policyErr });
    passwordHash = await bcrypt.hash(plainPassword, 12);
  }

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      phone: phone?.trim() || null,
      passwordHash,
      role,
      ...(inviteToken
        ? { passwordResetToken: inviteToken, passwordResetExpires: inviteExpires }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      totpEnabled: true,
      createdAt: true,
      isOwner: true,
      isTest: true,
    },
  });

  let ids =
    Array.isArray(branchIds) && branchIds.length > 0
      ? branchIds
      : scope.allBranches
        ? [await getDefaultBranchId()]
        : [scope.branchId!];

  const branchOptionalForRole =
    role === Role.ADMIN || (role === Role.MANAGER && actor.role === Role.ADMIN);
  if (!branchOptionalForRole && !ids.length) {
    await prisma.user.delete({ where: { id: user.id } });
    return res.status(400).json({ error: "Select at least one branch." });
  }

  if (actor.role === Role.MANAGER) {
    try {
      await assertManagerBranches(actor.id, ids);
    } catch (err) {
      await prisma.user.delete({ where: { id: user.id } });
      const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 400;
      const message = err instanceof Error ? err.message : "Invalid branches";
      return res.status(status).json({ error: message });
    }
  }

  try {
    if (role !== Role.ADMIN) {
      await syncUserBranches(user.id, ids);
    }
  } catch (err) {
    await prisma.user.delete({ where: { id: user.id } });
    const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 400;
    const message = err instanceof Error ? err.message : "Invalid branches";
    return res.status(status).json({ error: message });
  }

  await writeAudit(prisma, {
    actorId: actor.id,
    actorRole: actor.role,
    action: useInvite ? AuditAction.STAFF_INVITED : AuditAction.STAFF_CREATED,
    entityType: "user",
    entityId: user.id,
    after: { role: user.role, email: user.email, branchIds: ids, invite: useInvite },
    ip: clientIp(req),
  });

  let emailed = false;
  let temporaryPassword: string | undefined;
  if (useInvite && inviteToken) {
    const inviteUrl = `${clientAppUrl()}/reset-password?token=${inviteToken}`;
    void sendStaffInviteEmail(user.email, user.name, user.role, inviteUrl);
    emailed = true;
  } else if (plainPassword) {
    void sendStaffWelcomeEmail(user.email, user.name, user.role, plainPassword);
    emailed = true;
    if (Boolean(autoGeneratePassword) || !password?.trim()) {
      temporaryPassword = plainPassword;
    }
  }

  res.status(201).json({
    ...user,
    emailed,
    temporaryPassword,
  });
});

staffRouter.patch("/:id", requireAuth, requireStaffDirectory, async (req, res) => {
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing || !STAFF_ROLES.includes(existing.role)) {
    return res.status(404).json({ error: "Staff member not found." });
  }

  const actor = req.user!;
  const actorFlags = await loadActorFlags(actor.id);
  const target = toTarget(existing);
  const editErr = canEditTarget(actor, actorFlags.isOwner, target);
  if (editErr) return res.status(403).json({ error: editErr });

  const body = req.body as {
    name?: string;
    phone?: string | null;
    role?: Role;
    isActive?: boolean;
    branchIds?: string[];
  };

  if (existing.id === actor.id && body.isActive === false) {
    return res.status(400).json({ error: "You cannot disable your own account." });
  }
  if (existing.id === actor.id && body.role !== undefined && body.role !== existing.role) {
    return res.status(400).json({ error: "You cannot change your own role." });
  }

  const nextRole = body.role ?? existing.role;
  const nextActive = body.isActive !== undefined ? Boolean(body.isActive) : existing.isActive;

  if (body.role !== undefined && body.role !== existing.role) {
    const roleErr = canChangeRole(actor, actorFlags.isOwner, target, body.role);
    if (roleErr) return res.status(403).json({ error: roleErr });
  }

  const lastAdminErr = await assertNotLastActiveAdmin(target, nextActive, nextRole);
  if (lastAdminErr) return res.status(400).json({ error: lastAdminErr });

  if (existing.isOwner && body.role && body.role !== existing.role) {
    return res.status(400).json({ error: "The owner role cannot be reassigned." });
  }
  if (existing.isOwner && body.isActive === false) {
    return res.status(400).json({ error: "The owner account cannot be deactivated." });
  }

  const before = {
    name: existing.name,
    phone: existing.phone,
    role: existing.role,
    isActive: existing.isActive,
  };

  if (body.branchIds && existing.role !== Role.ADMIN) {
    if (actor.role === Role.MANAGER) {
      try {
        await assertManagerBranches(actor.id, body.branchIds);
      } catch (err) {
        const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 400;
        const message = err instanceof Error ? err.message : "Invalid branches";
        return res.status(status).json({ error: message });
      }
    }
    try {
      await syncUserBranches(existing.id, body.branchIds);
      await writeAudit(prisma, {
        actorId: actor.id,
        actorRole: actor.role,
        action: AuditAction.STAFF_BRANCHES_CHANGED,
        entityType: "user",
        entityId: existing.id,
        before: { branchIds: "updated" },
        after: { branchIds: body.branchIds },
        ip: clientIp(req),
      });
    } catch (err) {
      const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 400;
      const message = err instanceof Error ? err.message : "Invalid branches";
      return res.status(status).json({ error: message });
    }
  }

  const bumpSession = body.isActive === false;
  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: existing.id },
      data: {
        ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
        ...(body.phone !== undefined ? { phone: body.phone ? String(body.phone).trim() : null } : {}),
        ...(body.role !== undefined ? { role: body.role } : {}),
        ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
        ...(bumpSession ? { tokenVersion: { increment: 1 } } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        totpEnabled: true,
        createdAt: true,
        isOwner: true,
      },
    });

    if (body.role !== undefined && body.role !== existing.role) {
      await writeAudit(tx, {
        actorId: actor.id,
        actorRole: actor.role,
        action: AuditAction.STAFF_ROLE_CHANGED,
        entityType: "user",
        entityId: updated.id,
        before: { role: existing.role },
        after: { role: updated.role },
        ip: clientIp(req),
      });
    }
    if (body.isActive === false && existing.isActive) {
      await writeAudit(tx, {
        actorId: actor.id,
        actorRole: actor.role,
        action: AuditAction.STAFF_DEACTIVATED,
        entityType: "user",
        entityId: updated.id,
        before: { isActive: true },
        after: { isActive: false },
        ip: clientIp(req),
      });
    }
    if (body.isActive === true && !existing.isActive) {
      await writeAudit(tx, {
        actorId: actor.id,
        actorRole: actor.role,
        action: AuditAction.STAFF_REACTIVATED,
        entityType: "user",
        entityId: updated.id,
        before: { isActive: false },
        after: { isActive: true },
        ip: clientIp(req),
      });
    }
    if (
      body.name !== undefined ||
      body.phone !== undefined
    ) {
      await writeAudit(tx, {
        actorId: actor.id,
        actorRole: actor.role,
        action: AuditAction.STAFF_UPDATED,
        entityType: "user",
        entityId: updated.id,
        before,
        after: { name: updated.name, phone: updated.phone, role: updated.role, isActive: updated.isActive },
        ip: clientIp(req),
      });
    }
    return updated;
  });

  res.json(user);
});

staffRouter.post("/:id/reset-password", requireAuth, requireStaffDirectory, async (req, res) => {
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing || !STAFF_ROLES.includes(existing.role)) {
    return res.status(404).json({ error: "Staff member not found." });
  }
  const actor = req.user!;
  const actorFlags = await loadActorFlags(actor.id);
  const err = canResetPassword(actor, actorFlags.isOwner, toTarget(existing));
  if (err) return res.status(403).json({ error: err });

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.user.update({
    where: { id: existing.id },
    data: { passwordResetToken: token, passwordResetExpires: expires },
  });
  const resetUrl = `${clientAppUrl()}/reset-password?token=${token}`;
  const { sendPasswordResetEmail } = await import("../lib/email");
  void sendPasswordResetEmail(existing.email, existing.name, resetUrl);

  await writeAudit(prisma, {
    actorId: actor.id,
    actorRole: actor.role,
    action: AuditAction.STAFF_PASSWORD_RESET,
    entityType: "user",
    entityId: existing.id,
    ip: clientIp(req),
  });

  res.json({ ok: true, emailed: true });
});

staffRouter.post("/:id/reset-2fa", requireAuth, requireStaffDirectory, async (req, res) => {
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing || !STAFF_ROLES.includes(existing.role)) {
    return res.status(404).json({ error: "Staff member not found." });
  }
  const actor = req.user!;
  const actorFlags = await loadActorFlags(actor.id);
  const err = canResetTwoFa(actor, actorFlags.isOwner, toTarget(existing));
  if (err) return res.status(403).json({ error: err });

  await prisma.user.update({
    where: { id: existing.id },
    data: {
      totpEnabled: false,
      totpSecret: null,
      recoveryCodes: null,
      tokenVersion: { increment: 1 },
    },
  });

  await writeAudit(prisma, {
    actorId: actor.id,
    actorRole: actor.role,
    action: AuditAction.STAFF_2FA_RESET,
    entityType: "user",
    entityId: existing.id,
    before: { totpEnabled: existing.totpEnabled },
    after: { totpEnabled: false },
    ip: clientIp(req),
  });

  res.json({ ok: true });
});

staffRouter.post("/:id/revoke-sessions", requireAuth, requireStaffDirectory, async (req, res) => {
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing || !STAFF_ROLES.includes(existing.role)) {
    return res.status(404).json({ error: "Staff member not found." });
  }
  const actor = req.user!;
  const actorFlags = await loadActorFlags(actor.id);
  const err = canRevokeSessions(actor, actorFlags.isOwner, toTarget(existing));
  if (err) return res.status(403).json({ error: err });

  await prisma.user.update({
    where: { id: existing.id },
    data: { tokenVersion: { increment: 1 } },
  });

  await writeAudit(prisma, {
    actorId: actor.id,
    actorRole: actor.role,
    action: AuditAction.STAFF_SESSIONS_REVOKED,
    entityType: "user",
    entityId: existing.id,
    ip: clientIp(req),
  });

  res.json({ ok: true });
});

staffRouter.get("/:id/sessions", requireAuth, requireStaffDirectory, async (req, res) => {
  if (req.user!.role !== Role.ADMIN) {
    return res.status(403).json({ error: "Only admins can view staff sessions." });
  }
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing || !STAFF_ROLES.includes(existing.role)) {
    return res.status(404).json({ error: "Staff member not found." });
  }

  const logs = await prisma.auditLog.findMany({
    where: { actorId: existing.id, action: AuditAction.LOGIN_SUCCESS },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: { createdAt: true, ip: true, userAgent: true },
  });

  res.json({
    sessions: logs.map((row, index) => ({
      id: `login-${index}`,
      device: row.userAgent?.slice(0, 120) || "Unknown device",
      ipMasked: maskIp(row.ip),
      lastSeenAt: row.createdAt,
    })),
  });
});

staffRouter.get("/:id/audit", requireAuth, requireStaffDirectory, async (req, res) => {
  const actor = req.user!;
  if (actor.role !== Role.ADMIN) {
    return res.status(403).json({ error: "Only admins can view staff activity." });
  }
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing || !STAFF_ROLES.includes(existing.role)) {
    return res.status(404).json({ error: "Staff member not found." });
  }
  const logs = await prisma.auditLog.findMany({
    where: {
      OR: [{ actorId: existing.id }, { entityType: "user", entityId: existing.id }],
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      action: true,
      createdAt: true,
      before: true,
      after: true,
    },
  });
  res.json({ entries: logs });
});

staffRouter.patch("/me/approval-pin", requireAuth, requireRole(...APPROVAL_PIN_ROLES), async (req, res) => {
  const { pin } = req.body as { pin?: string };
  if (!pin || !isValidPinFormat(pin)) {
    return res.status(400).json({ error: "PIN must be 4–6 digits." });
  }
  await setApprovalPin(req.user!.id, pin);
  res.json({ ok: true });
});

staffRouter.patch("/:id/approval-pin", requireAuth, requireStaffDirectory, async (req, res) => {
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing || !APPROVAL_PIN_ROLES.includes(existing.role)) {
    return res.status(404).json({ error: "Manager account not found." });
  }
  const actor = req.user!;
  const actorFlags = await loadActorFlags(actor.id);
  const err = canSetApprovalPin(actor, actorFlags.isOwner, toTarget(existing));
  if (err) return res.status(403).json({ error: err });

  const { pin } = req.body as { pin?: string };
  if (!pin || !isValidPinFormat(pin)) {
    return res.status(400).json({ error: "PIN must be 4–6 digits." });
  }
  await setApprovalPin(existing.id, pin);
  res.json({ ok: true });
});
