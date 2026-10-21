import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import { generateSecret, generateURI, verifyTotp } from "../lib/totp";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { writeAudit } from "../lib/audit";
import { AuditAction } from "../lib/audit-actions";
import { clientIp } from "../lib/client-ip";
import { requireAuth, requireRole, signToken } from "../middleware/auth";
import { storeNameFrom } from "../lib/branding";
import { sendPasswordResetEmail } from "../lib/email";
import { getStoreSettings } from "../lib/settings-data";
import { authLimiter } from "../middleware/security";
import { jwtSecret } from "../lib/jwt-secret";
import {
  GENERIC_LOGIN_ERROR,
  LOCKED_LOGIN_ERROR,
  isLocked,
  nextLockState,
} from "../lib/login-guard";
import { createRecoveryCodes, matchRecoveryCode } from "../lib/recovery-codes";
import { clearCsrfCookie, issueCsrfCookie } from "../lib/csrf-cookie";
import { clearSessionCookie, cookieSecure, sessionCookie } from "../lib/session-cookie";

const JWT_SECRET = jwtSecret();

function issueSession(res: import("express").Response, req: import("express").Request, user: {
  id: string;
  role: Role;
  email: string;
  name: string;
  tokenVersion: number;
  phone: string | null;
  totpEnabled?: boolean;
}) {
  const token = signToken({
    id: user.id,
    role: user.role,
    email: user.email,
    name: user.name,
    tv: user.tokenVersion,
  });
  const secure = cookieSecure(req.header("x-forwarded-proto") || undefined);
  res.setHeader("Set-Cookie", sessionCookie(token, secure));
  issueCsrfCookie(res, secure);
  return token;
}

function authResponseBody(token: string, user: Parameters<typeof publicUser>[0]) {
  const body: { user: ReturnType<typeof publicUser>; token?: string } = { user: publicUser(user) };
  if (process.env.NODE_ENV !== "production" || process.env.AUTH_TOKEN_IN_BODY === "1") {
    body.token = token;
  }
  return body;
}

export const authRouter = Router();

function publicUser(user: {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string | null;
  totpEnabled?: boolean;
  loyaltyPoints?: number;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    totpEnabled: Boolean(user.totpEnabled),
    loyaltyPoints: user.role === Role.CUSTOMER ? user.loyaltyPoints ?? 0 : undefined,
  };
}

authRouter.post("/register", authLimiter, async (req, res) => {
  const { name, email, password, phone } = req.body as {
    name?: string;
    email?: string;
    password?: string;
    phone?: string;
  };
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email and password are required." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (exists) return res.status(409).json({ error: "An account with this email already exists." });

  const normalizedPhone = phone?.replace(/[^\d+]/g, "").trim() || null;
  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash: await bcrypt.hash(password, 12),
      role: Role.CUSTOMER,
      phone: normalizedPhone,
    },
  });

  if (normalizedPhone && normalizedPhone.length >= 10) {
    const digits = normalizedPhone.slice(-10);
    await prisma.order.updateMany({
      where: {
        customerId: null,
        customerPhone: { endsWith: digits },
      },
      data: { customerId: user.id },
    });
  }

  const token = issueSession(res, req, user);
  res.json(authResponseBody(token, user));
});

authRouter.post("/login", authLimiter, async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) return res.status(400).json({ error: "Email and password are required." });

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (user && isLocked(user.lockedUntil)) {
    return res.status(429).json({ error: LOCKED_LOGIN_ERROR });
  }
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
    if (user?.isActive) {
      await prisma.user.update({ where: { id: user.id }, data: nextLockState(user.failedLoginCount) });
    }
    if (user?.isActive) {
      await writeAudit(prisma, {
        actorId: user.id,
        actorRole: user.role,
        action: AuditAction.LOGIN_FAILED,
        entityType: "user",
        entityId: user.id,
        ip: clientIp(req),
      });
    } else {
      await writeAudit(prisma, {
        action: AuditAction.LOGIN_FAILED,
        entityType: "user",
        entityId: email.toLowerCase().trim(),
        ip: clientIp(req),
      });
    }
    return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  if (user.totpEnabled && user.totpSecret) {
    const challengeToken = jwt.sign({ id: user.id, typ: "2fa" }, JWT_SECRET, { expiresIn: "5m" });
    return res.json({ requiresTwoFactor: true, challengeToken });
  }

  const token = issueSession(res, req, user);
  if (user.role !== Role.CUSTOMER) {
    await writeAudit(prisma, {
      actorId: user.id,
      actorRole: user.role,
      action: AuditAction.LOGIN_SUCCESS,
      entityType: "user",
      entityId: user.id,
      ip: clientIp(req),
    });
  }
  res.json(authResponseBody(token, user));
});

authRouter.get("/csrf", (req, res) => {
  const secure = cookieSecure(req.header("x-forwarded-proto") || undefined);
  const token = issueCsrfCookie(res, secure);
  res.json({ csrfToken: token });
});

authRouter.get("/socket-token", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, role: true, email: true, name: true, tokenVersion: true, isActive: true },
  });
  if (!user?.isActive) return res.status(401).json({ error: "Session expired." });
  const token = jwt.sign(
    { id: user.id, role: user.role, email: user.email, name: user.name, tv: user.tokenVersion, typ: "ws" },
    JWT_SECRET,
    { expiresIn: "15m" }
  );
  res.json({ token });
});

authRouter.post("/login/2fa", authLimiter, async (req, res) => {
  const { challengeToken, code } = req.body as { challengeToken?: string; code?: string };
  if (!challengeToken || !code) {
    return res.status(400).json({ error: "Authenticator code is required." });
  }
  try {
    const payload = jwt.verify(challengeToken, JWT_SECRET) as { id: string; typ?: string };
    if (payload.typ !== "2fa") throw new Error("bad");
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user?.totpEnabled || !user.totpSecret || !user.isActive) {
      return res.status(401).json({ error: "Two-factor login is not available." });
    }
    if (!verifyTotp(user.totpSecret, String(code))) {
      const recovery = matchRecoveryCode(user.recoveryCodes, String(code));
      if (!recovery.ok) {
        const next = nextLockState(user.failedLoginCount);
        await prisma.user.update({ where: { id: user.id }, data: next });
        if (next.lockedUntil) return res.status(429).json({ error: LOCKED_LOGIN_ERROR });
        return res.status(401).json({ error: "Invalid authenticator code." });
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { recoveryCodes: recovery.remaining, failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
      });
      const token = issueSession(res, req, user);
      return res.json(authResponseBody(token, user));
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    const token = issueSession(res, req, user);
    res.json(authResponseBody(token, user));
  } catch {
    return res.status(401).json({ error: "Challenge expired. Sign in again." });
  }
});

function clientAppUrl() {
  const raw = process.env.CLIENT_URL || process.env.FRONTEND_URL || "http://localhost:3000";
  return raw.split(",")[0].trim();
}

authRouter.post("/forgot-password", authLimiter, async (req, res) => {
  const email = String((req.body as { email?: string }).email || "")
    .trim()
    .toLowerCase();
  if (!email) return res.status(400).json({ error: "Email is required." });

  const user = await prisma.user.findUnique({ where: { email } });
  if (
    user &&
    user.isActive &&
    (user.role === Role.CUSTOMER ||
      user.role === Role.ADMIN ||
      user.role === Role.CHEF ||
      user.role === Role.RIDER ||
      user.role === Role.CASHIER ||
      user.role === Role.MANAGER ||
      user.role === Role.WAITER)
  ) {
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: token, passwordResetExpires: expires },
    });
    const resetUrl = `${clientAppUrl()}/reset-password?token=${token}`;
    void sendPasswordResetEmail(user.email, user.name, resetUrl);
  }

  res.json({ ok: true, message: "If an account exists for that email, a reset link has been sent." });
});

authRouter.post("/reset-password", authLimiter, async (req, res) => {
  const { token, password } = req.body as { token?: string; password?: string };
  if (!token?.trim() || !password) {
    return res.status(400).json({ error: "Token and new password are required." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: token.trim(),
      passwordResetExpires: { gt: new Date() },
    },
  });
  if (!user) {
    return res.status(400).json({ error: "Reset link is invalid or has expired." });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(password, 12),
      passwordResetToken: null,
      passwordResetExpires: null,
      tokenVersion: { increment: 1 },
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });

  res.json({ ok: true, message: "Password updated. You can sign in now." });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: "User not found" });
  if (!user.isActive) return res.status(403).json({ error: "This account is disabled." });
  res.json(publicUser(user));
});

authRouter.post("/change-password", requireAuth, authLimiter, async (req, res) => {
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new password are required." });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters." });
  }
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user || !user.isActive) return res.status(404).json({ error: "User not found." });
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return res.status(400).json({ error: "Current password is incorrect." });
  }
  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    return res.status(400).json({ error: "New password must be different from your current password." });
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(newPassword, 12),
      tokenVersion: { increment: 1 },
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });
  const token = issueSession(res, req, updated);
  res.json({ ...authResponseBody(token, updated), message: "Password updated." });
});

authRouter.post("/2fa/setup", requireAuth, requireRole(Role.ADMIN, Role.MANAGER), async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.totpEnabled) {
    return res.status(400).json({ error: "Authenticator is already enabled. Disable it first to reset." });
  }
  const secret = generateSecret();
  await prisma.user.update({ where: { id: user.id }, data: { totpSecret: secret, totpEnabled: false } });
  const settings = await getStoreSettings();
  const otpauth = generateURI({ issuer: storeNameFrom(settings), label: user.email, secret });
  const qrDataUrl = await QRCode.toDataURL(otpauth, { width: 220, margin: 1 });
  res.json({ secret, otpauth, qrDataUrl });
});

authRouter.post("/2fa/enable", requireAuth, requireRole(Role.ADMIN, Role.MANAGER), async (req, res) => {
  const { code } = req.body as { code?: string };
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user?.totpSecret) return res.status(400).json({ error: "Set up authenticator first." });
  if (!verifyTotp(user.totpSecret, String(code || ""))) {
    return res.status(400).json({ error: "Invalid authenticator code." });
  }
  const recovery = createRecoveryCodes();
  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: true, recoveryCodes: recovery.stored },
  });
  res.json({ ok: true, totpEnabled: true, recoveryCodes: recovery.plain });
});

authRouter.post("/2fa/disable", requireAuth, requireRole(Role.ADMIN, Role.MANAGER), async (req, res) => {
  const { code, password } = req.body as { code?: string; password?: string };
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.totpEnabled && user.totpSecret) {
    if (!verifyTotp(user.totpSecret, String(code || ""))) {
      return res.status(400).json({ error: "Invalid authenticator code." });
    }
  } else if (!password || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(400).json({ error: "Password required to disable 2FA." });
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: false, totpSecret: null, recoveryCodes: null },
  });
  res.json({ ok: true, totpEnabled: false });
});

authRouter.post("/logout", (req, res) => {
  const secure = cookieSecure(req.header("x-forwarded-proto") || undefined);
  res.setHeader("Set-Cookie", clearSessionCookie(secure));
  res.append("Set-Cookie", clearCsrfCookie(secure));
  res.json({ ok: true });
});

authRouter.post("/logout-all", requireAuth, async (req, res) => {
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { tokenVersion: { increment: 1 } },
  });
  const secure = cookieSecure(req.header("x-forwarded-proto") || undefined);
  res.setHeader("Set-Cookie", clearSessionCookie(secure));
  res.append("Set-Cookie", clearCsrfCookie(secure));
  res.json({ ok: true });
});
