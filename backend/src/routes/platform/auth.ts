import { Router } from "express";
import bcrypt from "bcryptjs";
import { authLimiter } from "../../middleware/security";
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

export const platformAuthRouter = Router();

const GENERIC_LOGIN_ERROR = "Invalid email or password.";

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
  if (!user?.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
  }
  await basePrisma.platformUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
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
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: permissionsForRole(user.role),
    },
    ...(process.env.NODE_ENV !== "production" || process.env.AUTH_TOKEN_IN_BODY === "1" ? { token } : {}),
  });
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

platformAuthRouter.get("/me", requirePlatformAuth, (req, res) => {
  const user = req.platformUser!;
  res.json({
    user: { ...user, permissions: permissionsForRole(user.role) },
  });
});
