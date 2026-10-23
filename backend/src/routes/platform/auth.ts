import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import { authLimiter, platformTotpLimiter } from "../../middleware/security";
import {
  clearPlatformSessionCookie,
  issuePlatformCsrfCookie,
  platformCookieSecure,
  platformSessionCookie,
} from "../../lib/platform/platform-cookies";
import { basePrisma } from "../../lib/prisma-base";
import { permissionsForRole } from "../../lib/platform/permissions";
import { requirePlatformAuth, signPlatformToken } from "../../middleware/platform-auth";
import { writePlatformAudit } from "../../lib/platform/platform-audit";
import { clientIp } from "../../lib/client-ip";
import { platformJwtSecret } from "../../lib/platform/jwt-secret";
import { isLocked, LOCKED_LOGIN_ERROR, nextLockState } from "../../lib/login-guard";
import { generateSecret, generateURI, verifyTotp } from "../../lib/totp";
import { createRecoveryCodes, matchRecoveryCode } from "../../lib/recovery-codes";
import { loadPlatformSettings } from "../../lib/platform/platform-settings";
export const platformAuthRouter = Router();

const GENERIC_LOGIN_ERROR = "Invalid email or password.";
const JWT_SECRET = platformJwtSecret();

function platformUserResponse(user: {
  id: string;
  email: string;
  name: string;
  role: import("@prisma/client").PlatformRole;
  totpEnabled?: boolean;
}) {
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      totpEnabled: Boolean(user.totpEnabled),
      permissions: permissionsForRole(user.role),
    },
  };
}

function issuePlatformSession(
  res: import("express").Response,
  req: import("express").Request,
  user: { id: string; email: string; name: string; role: import("@prisma/client").PlatformRole; tokenVersion: number }
) {
  const token = signPlatformToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tv: user.tokenVersion,
  });
  const secure = platformCookieSecure(req.header("x-forwarded-proto") || undefined);
  res.setHeader("Set-Cookie", platformSessionCookie(token, secure));
  issuePlatformCsrfCookie(res, secure);
  return token;
}

platformAuthRouter.get("/csrf", (req, res) => {
  const secure = platformCookieSecure(req.header("x-forwarded-proto") || undefined);
  const token = issuePlatformCsrfCookie(res, secure);
  res.json({ csrfToken: token });
});

platformAuthRouter.post("/login", authLimiter, async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email?.trim() || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  const normalized = email.trim().toLowerCase();
  const user = await basePrisma.platformUser.findUnique({ where: { email: normalized } });
  if (user && isLocked(user.lockedUntil)) {
    return res.status(429).json({ error: LOCKED_LOGIN_ERROR });
  }
  if (!user?.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
    if (user?.isActive) {
      await basePrisma.platformUser.update({
        where: { id: user.id },
        data: nextLockState(user.failedLoginCount),
      });
      await writePlatformAudit({
        actorId: user.id,
        actorEmail: user.email,
        action: "platform.login_failed",
        entityType: "platform_user",
        entityId: user.id,
        ip: clientIp(req),
        userAgent: req.headers["user-agent"] || null,
      });
    }
    return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
  }

  const { data: settings } = await loadPlatformSettings();
  if (settings.require2FAForAllPlatformUsers && !user.totpEnabled) {
    return res.status(403).json({
      error: "Two-factor authentication is required. Ask a super admin to reset your 2FA, then set it up after signing in.",
      code: "2FA_REQUIRED",
    });
  }

  if (user.totpEnabled && user.totpSecret) {
    const challengeToken = jwt.sign({ id: user.id, typ: "platform_2fa" }, JWT_SECRET, { expiresIn: "5m" });
    return res.json({ requiresTwoFactor: true, challengeToken });
  }

  await basePrisma.platformUser.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  const token = issuePlatformSession(res, req, user);
  await writePlatformAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: "platform.login",
    entityType: "platform_user",
    entityId: user.id,
    ip: clientIp(req),
    userAgent: req.headers["user-agent"] || null,
  });
  res.json({
    ...platformUserResponse(user),
    ...(process.env.NODE_ENV !== "production" || process.env.AUTH_TOKEN_IN_BODY === "1" ? { token } : {}),
  });
});

platformAuthRouter.post("/login/2fa", authLimiter, platformTotpLimiter, async (req, res) => {
  const { challengeToken, code } = req.body as { challengeToken?: string; code?: string };
  if (!challengeToken || !code) {
    return res.status(400).json({ error: "Authenticator code is required." });
  }
  try {
    const payload = jwt.verify(challengeToken, JWT_SECRET) as { id: string; typ?: string };
    if (payload.typ !== "platform_2fa") throw new Error("bad");
    const user = await basePrisma.platformUser.findUnique({ where: { id: payload.id } });
    if (user && isLocked(user.lockedUntil)) {
      return res.status(429).json({ error: LOCKED_LOGIN_ERROR });
    }
    if (!user?.totpEnabled || !user.totpSecret || !user.isActive) {
      return res.status(401).json({ error: "Two-factor login is not available." });
    }
    let recoveryUsed = false;
    if (!verifyTotp(user.totpSecret, String(code))) {
      const recovery = matchRecoveryCode(user.recoveryCodes, String(code));
      if (!recovery.ok) {
        const next = nextLockState(user.failedLoginCount);
        await basePrisma.platformUser.update({ where: { id: user.id }, data: next });
        await writePlatformAudit({
          actorId: user.id,
          actorEmail: user.email,
          action: "platform.login_2fa_failed",
          entityType: "platform_user",
          entityId: user.id,
          ip: clientIp(req),
        });
        if (next.lockedUntil) return res.status(429).json({ error: LOCKED_LOGIN_ERROR });
        return res.status(401).json({ error: "Invalid authenticator code." });
      }
      recoveryUsed = true;
      await basePrisma.platformUser.update({
        where: { id: user.id },
        data: { recoveryCodes: recovery.remaining },
      });
    }
    await basePrisma.platformUser.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    const token = issuePlatformSession(res, req, user);
    await writePlatformAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: recoveryUsed ? "platform.login_2fa_recovery" : "platform.login",
      entityType: "platform_user",
      entityId: user.id,
      ip: clientIp(req),
    });
    res.json({
      ...platformUserResponse(user),
      ...(process.env.NODE_ENV !== "production" || process.env.AUTH_TOKEN_IN_BODY === "1" ? { token } : {}),
    });
  } catch {
    return res.status(401).json({ error: "Two-factor session expired. Sign in again." });
  }
});

platformAuthRouter.post("/logout", requirePlatformAuth, async (req, res) => {
  const secure = platformCookieSecure(req.header("x-forwarded-proto") || undefined);
  res.setHeader("Set-Cookie", clearPlatformSessionCookie(secure));
  await writePlatformAudit({
    actorId: req.platformUser!.id,
    actorEmail: req.platformUser!.email,
    action: "platform.logout",
    entityType: "platform_user",
    entityId: req.platformUser!.id,
    ip: clientIp(req),
  });
  res.json({ ok: true });
});

platformAuthRouter.get("/me", requirePlatformAuth, async (req, res) => {
  const row = await basePrisma.platformUser.findUnique({
    where: { id: req.platformUser!.id },
    select: { id: true, email: true, name: true, role: true, totpEnabled: true },
  });
  if (!row) return res.status(401).json({ error: "Session expired." });
  res.json(platformUserResponse(row));
});

platformAuthRouter.post("/2fa/setup", requirePlatformAuth, async (req, res) => {
  const user = await basePrisma.platformUser.findUnique({ where: { id: req.platformUser!.id } });
  if (!user) return res.status(404).json({ error: "Not found." });
  if (user.totpEnabled) {
    return res.status(400).json({ error: "Authenticator is already enabled. Ask a super admin to reset it first." });
  }
  const secret = generateSecret();
  await basePrisma.platformUser.update({
    where: { id: user.id },
    data: { totpSecret: secret, totpEnabled: false },
  });
  const otpauth = generateURI({ issuer: "Restaurant OS Platform", label: user.email, secret });
  const qrDataUrl = await QRCode.toDataURL(otpauth, { width: 220, margin: 1 });
  res.json({ secret, otpauth, qrDataUrl });
});

platformAuthRouter.post("/2fa/enable", requirePlatformAuth, async (req, res) => {
  const { code } = req.body as { code?: string };
  const user = await basePrisma.platformUser.findUnique({ where: { id: req.platformUser!.id } });
  if (!user?.totpSecret) return res.status(400).json({ error: "Set up authenticator first." });
  if (!verifyTotp(user.totpSecret, String(code || ""))) {
    return res.status(400).json({ error: "Invalid authenticator code." });
  }
  const recovery = createRecoveryCodes(10);
  await basePrisma.platformUser.update({
    where: { id: user.id },
    data: { totpEnabled: true, recoveryCodes: recovery.stored },
  });
  await writePlatformAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: "platform.2fa_enabled",
    entityType: "platform_user",
    entityId: user.id,
    ip: clientIp(req),
  });
  res.json({ ok: true, totpEnabled: true, recoveryCodes: recovery.plain });
});

platformAuthRouter.post("/2fa/disable", requirePlatformAuth, async (req, res) => {
  const { code, password } = req.body as { code?: string; password?: string };
  const user = await basePrisma.platformUser.findUnique({ where: { id: req.platformUser!.id } });
  if (!user) return res.status(404).json({ error: "Not found." });
  const { data: settings } = await loadPlatformSettings();
  if (settings.require2FAForAllPlatformUsers) {
    return res.status(400).json({ error: "2FA is required for all platform users and cannot be disabled." });
  }
  if (user.totpEnabled && user.totpSecret) {
    if (!verifyTotp(user.totpSecret, String(code || ""))) {
      return res.status(400).json({ error: "Invalid authenticator code." });
    }
  } else if (!password || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(400).json({ error: "Password required to disable 2FA." });
  }
  await basePrisma.platformUser.update({
    where: { id: user.id },
    data: { totpEnabled: false, totpSecret: null, recoveryCodes: null },
  });
  await writePlatformAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: "platform.2fa_disabled",
    entityType: "platform_user",
    entityId: user.id,
    ip: clientIp(req),
  });
  res.json({ ok: true, totpEnabled: false });
});
