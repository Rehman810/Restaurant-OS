import { Router } from "express";
import bcrypt from "bcryptjs";
import { PlatformRole } from "@prisma/client";
import { basePrisma } from "../../lib/prisma-base";
import { requirePlatformAuth, requirePlatformPermission } from "../../middleware/platform-auth";
import { writePlatformAudit } from "../../lib/platform/platform-audit";
import { clientIp } from "../../lib/client-ip";
import { permissionsForRole, type PlatformPermission } from "../../lib/platform/permissions";
import { assertCanDemoteOrDeactivateSuperAdmin } from "../../lib/platform/platform-users-guard";

export const platformUsersRouter = Router();

const ROLE_MATRIX: Array<{ role: PlatformRole; permissions: PlatformPermission[] }> = (
  Object.values(PlatformRole) as PlatformRole[]
).map((role) => ({ role, permissions: permissionsForRole(role) }));

platformUsersRouter.get(
  "/matrix",
  requirePlatformAuth,
  requirePlatformPermission("platform_users:read"),
  (_req, res) => {
    res.json({ matrix: ROLE_MATRIX });
  }
);

platformUsersRouter.get("/", requirePlatformAuth, requirePlatformPermission("platform_users:read"), async (_req, res) => {
  const rows = await basePrisma.platformUser.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      totpEnabled: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
  res.json({ users: rows });
});

platformUsersRouter.post("/", requirePlatformAuth, requirePlatformPermission("platform_users:write"), async (req, res) => {
  const { email, name, role, password } = req.body as {
    email?: string;
    name?: string;
    role?: PlatformRole;
    password?: string;
  };
  const normalized = email?.trim().toLowerCase() || "";
  const displayName = name?.trim() || "";
  const nextRole = role && Object.values(PlatformRole).includes(role) ? role : PlatformRole.READONLY;
  const pass = password?.trim() || "";
  if (!normalized || !displayName || pass.length < 12) {
    return res.status(400).json({ error: "Email, name, and a password of at least 12 characters are required." });
  }
  const existing = await basePrisma.platformUser.findUnique({ where: { email: normalized } });
  if (existing) return res.status(409).json({ error: "A platform user with that email already exists." });
  const passwordHash = await bcrypt.hash(pass, 12);
  const user = await basePrisma.platformUser.create({
    data: { email: normalized, name: displayName, role: nextRole, passwordHash },
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
  });
  await writePlatformAudit({
    actorId: req.platformUser!.id,
    actorEmail: req.platformUser!.email,
    action: "platform_user.created",
    entityType: "platform_user",
    entityId: user.id,
    after: { email: user.email, role: user.role },
    ip: clientIp(req),
  });
  res.status(201).json({ user });
});

platformUsersRouter.patch(
  "/:id",
  requirePlatformAuth,
  requirePlatformPermission("platform_users:write"),
  async (req, res) => {
    const { name, role, isActive } = req.body as { name?: string; role?: PlatformRole; isActive?: boolean };
    const existing = await basePrisma.platformUser.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Not found." });

    const data: { name?: string; role?: PlatformRole; isActive?: boolean; tokenVersion?: { increment: number } } = {};
    if (name !== undefined) data.name = String(name).trim();
    if (role !== undefined) {
      if (!Object.values(PlatformRole).includes(role)) {
        return res.status(400).json({ error: "Invalid role." });
      }
      try {
        await assertCanDemoteOrDeactivateSuperAdmin(existing.id, role);
      } catch (err) {
        const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 400;
        const message = err instanceof Error ? err.message : "Cannot change role.";
        return res.status(status).json({ error: message });
      }
      data.role = role;
    }
    if (isActive !== undefined) {
      if (!isActive) {
        try {
          await assertCanDemoteOrDeactivateSuperAdmin(existing.id, undefined, true);
        } catch (err) {
          const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 400;
          const message = err instanceof Error ? err.message : "Cannot deactivate.";
          return res.status(status).json({ error: message });
        }
      }
      data.isActive = Boolean(isActive);
      if (!isActive) data.tokenVersion = { increment: 1 };
    }

    const updated = await basePrisma.platformUser.update({
      where: { id: existing.id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        totpEnabled: true,
        lastLoginAt: true,
      },
    });
    await writePlatformAudit({
      actorId: req.platformUser!.id,
      actorEmail: req.platformUser!.email,
      action: "platform_user.updated",
      entityType: "platform_user",
      entityId: updated.id,
      before: { role: existing.role, isActive: existing.isActive, name: existing.name },
      after: { role: updated.role, isActive: updated.isActive, name: updated.name },
      ip: clientIp(req),
    });
    res.json({ user: updated });
  }
);

platformUsersRouter.post(
  "/:id/reset-password",
  requirePlatformAuth,
  requirePlatformPermission("platform_users:write"),
  async (req, res) => {
    const password = String((req.body as { password?: string }).password || "").trim();
    if (password.length < 12) {
      return res.status(400).json({ error: "Password must be at least 12 characters." });
    }
    const existing = await basePrisma.platformUser.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Not found." });
    const passwordHash = await bcrypt.hash(password, 12);
    await basePrisma.platformUser.update({
      where: { id: existing.id },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    });
    await writePlatformAudit({
      actorId: req.platformUser!.id,
      actorEmail: req.platformUser!.email,
      action: "platform_user.password_reset",
      entityType: "platform_user",
      entityId: existing.id,
      ip: clientIp(req),
    });
    res.json({ ok: true });
  }
);

platformUsersRouter.post(
  "/:id/force-logout",
  requirePlatformAuth,
  requirePlatformPermission("platform_users:write"),
  async (req, res) => {
    const existing = await basePrisma.platformUser.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Not found." });
    await basePrisma.platformUser.update({
      where: { id: existing.id },
      data: { tokenVersion: { increment: 1 } },
    });
    await writePlatformAudit({
      actorId: req.platformUser!.id,
      actorEmail: req.platformUser!.email,
      action: "platform_user.force_logout",
      entityType: "platform_user",
      entityId: existing.id,
      ip: clientIp(req),
    });
    res.json({ ok: true });
  }
);

platformUsersRouter.post(
  "/:id/reset-2fa",
  requirePlatformAuth,
  requirePlatformPermission("platform_users:write"),
  async (req, res) => {
    const existing = await basePrisma.platformUser.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Not found." });
    await basePrisma.platformUser.update({
      where: { id: existing.id },
      data: { totpEnabled: false, totpSecret: null, recoveryCodes: null },
    });
    await writePlatformAudit({
      actorId: req.platformUser!.id,
      actorEmail: req.platformUser!.email,
      action: "platform_user.2fa_reset",
      entityType: "platform_user",
      entityId: existing.id,
      before: { totpEnabled: existing.totpEnabled },
      after: { totpEnabled: false },
      ip: clientIp(req),
    });
    res.json({ ok: true });
  }
);
