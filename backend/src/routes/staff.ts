import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  branchScopeError,
  getDefaultBranchId,
  resolveBranchScope,
  staffWhereForScope,
  syncUserBranches,
} from "../lib/branch-scope";
import { requireAuth, requireRole } from "../middleware/auth";
import { writeAudit } from "../lib/audit";
import { AuditAction } from "../lib/audit-actions";
import { clientIp } from "../lib/client-ip";
import { sendStaffWelcomeEmail } from "../lib/email";
import { STAFF_DIRECTORY_ROLES } from "../lib/roles";
import { APPROVAL_PIN_ROLES, isValidPinFormat, setApprovalPin } from "../lib/approval-pin";

export const staffRouter = Router();

const STAFF_ROLES = STAFF_DIRECTORY_ROLES;
const ASSIGNABLE_ROLES: Role[] = [Role.MANAGER, Role.WAITER, Role.CHEF, Role.RIDER, Role.CASHIER];

function generateStaffPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) out += chars[bytes[i] % chars.length];
  return out;
}

staffRouter.get("/", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }

  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const search = String(req.query.search || "").trim().toLowerCase();

  const scopeWhere = staffWhereForScope(scope);
  const where = {
    AND: [
      scopeWhere,
      ...(search
        ? [
            {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { email: { contains: search, mode: "insensitive" as const } },
                { phone: { contains: search } },
              ],
            },
          ]
        : []),
    ],
  };

  const [staff, total, roleCounts, activeCount] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        totpEnabled: true,
        createdAt: true,
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      take: limit,
      skip: offset,
    }),
    prisma.user.count({ where }),
    prisma.user.groupBy({
      by: ["role"],
      where: scopeWhere,
      _count: { _all: true },
    }),
    prisma.user.count({ where: { AND: [scopeWhere, { isActive: true }] } }),
  ]);

  const branchMembers = staff.length
    ? await prisma.branchMember.findMany({
        where: { userId: { in: staff.map((s) => s.id) } },
        select: { userId: true, branchId: true },
      })
    : [];

  const branchIdsByUser = new Map<string, string[]>();
  for (const row of branchMembers) {
    const list = branchIdsByUser.get(row.userId) ?? [];
    list.push(row.branchId);
    branchIdsByUser.set(row.userId, list);
  }

  res.json({
    staff: staff.map((s) => ({ ...s, branchIds: branchIdsByUser.get(s.id) ?? [] })),
    total,
    limit,
    offset,
    stats: {
      total: roleCounts.reduce((sum, row) => sum + row._count._all, 0),
      chefs: roleCounts.find((row) => row.role === Role.CHEF)?._count._all ?? 0,
      riders: roleCounts.find((row) => row.role === Role.RIDER)?._count._all ?? 0,
      active: activeCount,
    },
  });
});

staffRouter.post("/", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }

  const { name, email, phone, password, role, autoGeneratePassword, branchIds } = req.body as {
    name?: string;
    email?: string;
    phone?: string;
    password?: string;
    role?: Role;
    autoGeneratePassword?: boolean;
    branchIds?: string[];
  };
  if (!name?.trim() || !email?.trim()) {
    return res.status(400).json({ error: "Name and email are required." });
  }
  if (role === Role.ADMIN) {
    return res.status(400).json({ error: "Cannot create additional admin accounts." });
  }
  if (!role || !ASSIGNABLE_ROLES.includes(role)) {
    return res.status(400).json({ error: "Role must be CHEF, RIDER, or CASHIER." });
  }
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) return res.status(409).json({ error: "An account with this email already exists." });

  const generated = Boolean(autoGeneratePassword);
  const plainPassword = password?.trim() || generateStaffPassword();
  if (plainPassword.length < 6) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      phone: phone?.trim() || null,
      passwordHash: await bcrypt.hash(plainPassword, 12),
      role,
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
    },
  });
  const ids =
    Array.isArray(branchIds) && branchIds.length > 0
      ? branchIds
      : scope.allBranches
        ? [await getDefaultBranchId()]
        : [scope.branchId!];
  try {
    await syncUserBranches(user.id, ids);
  } catch (err) {
    await prisma.user.delete({ where: { id: user.id } });
    const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 400;
    const message = err instanceof Error ? err.message : "Invalid branches";
    return res.status(status).json({ error: message });
  }

  await writeAudit(prisma, {
    actorId: req.user!.id,
    actorRole: req.user!.role,
    action: AuditAction.STAFF_CREATED,
    entityType: "user",
    entityId: user.id,
    after: { role: user.role, email: user.email, branchIds: ids },
    ip: clientIp(req),
  });

  const emailed = generated || !password?.trim();
  if (emailed) {
    void sendStaffWelcomeEmail(user.email, user.name, user.role, plainPassword);
  }
  res.status(201).json({ ...user, emailed });
});

staffRouter.patch("/:id", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing || !STAFF_ROLES.includes(existing.role)) {
    return res.status(404).json({ error: "Staff member not found." });
  }

  const body = req.body as {
    name?: string;
    phone?: string | null;
    role?: Role;
    isActive?: boolean;
    password?: string;
    branchIds?: string[];
  };

  if (existing.id === req.user!.id && body.isActive === false) {
    return res.status(400).json({ error: "You cannot disable your own account." });
  }
  if (existing.role === Role.ADMIN && (body.role && body.role !== Role.ADMIN || body.isActive === false)) {
    const otherAdmins = await prisma.user.count({
      where: { role: Role.ADMIN, isActive: true, id: { not: existing.id } },
    });
    if (otherAdmins === 0) {
      return res.status(400).json({ error: "Keep at least one active admin." });
    }
  }
  if (body.role === Role.ADMIN && existing.role !== Role.ADMIN) {
    return res.status(400).json({ error: "Cannot assign admin role." });
  }
  if (existing.role === Role.ADMIN && body.role && body.role !== Role.ADMIN) {
    return res.status(400).json({ error: "The admin account role cannot be changed." });
  }
  if (body.role && !ASSIGNABLE_ROLES.includes(body.role) && body.role !== Role.ADMIN) {
    return res.status(400).json({ error: "Invalid staff role." });
  }
  if (body.role && existing.role !== Role.ADMIN && !ASSIGNABLE_ROLES.includes(body.role)) {
    return res.status(400).json({ error: "Role must be CHEF, RIDER, or CASHIER." });
  }
  if (body.password && body.password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  const bumpSession = body.isActive === false || Boolean(body.password);
  if (body.branchIds && existing.role !== Role.ADMIN) {
    try {
      await syncUserBranches(existing.id, body.branchIds);
    } catch (err) {
      const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 400;
      const message = err instanceof Error ? err.message : "Invalid branches";
      return res.status(status).json({ error: message });
    }
  }

  const passwordHash = body.password ? await bcrypt.hash(body.password, 12) : undefined;
  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: existing.id },
      data: {
        ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
        ...(body.phone !== undefined ? { phone: body.phone ? String(body.phone).trim() : null } : {}),
        ...(body.role !== undefined ? { role: body.role } : {}),
        ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
        ...(passwordHash ? { passwordHash } : {}),
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
      },
    });
    if (body.role !== undefined && body.role !== existing.role) {
      await writeAudit(tx, {
        actorId: req.user!.id,
        actorRole: req.user!.role,
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
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: AuditAction.STAFF_DEACTIVATED,
        entityType: "user",
        entityId: updated.id,
        before: { isActive: true },
        after: { isActive: false },
        ip: clientIp(req),
      });
    }
    return updated;
  });
  res.json(user);
});

staffRouter.patch("/me/approval-pin", requireAuth, requireRole(...APPROVAL_PIN_ROLES), async (req, res) => {
  const { pin } = req.body as { pin?: string };
  if (!pin || !isValidPinFormat(pin)) {
    return res.status(400).json({ error: "PIN must be 4–6 digits." });
  }
  await setApprovalPin(req.user!.id, pin);
  res.json({ ok: true });
});

staffRouter.patch("/:id/approval-pin", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing || !APPROVAL_PIN_ROLES.includes(existing.role)) {
    return res.status(404).json({ error: "Manager account not found." });
  }
  const { pin } = req.body as { pin?: string };
  if (!pin || !isValidPinFormat(pin)) {
    return res.status(400).json({ error: "PIN must be 4–6 digits." });
  }
  await setApprovalPin(existing.id, pin);
  res.json({ ok: true });
});
