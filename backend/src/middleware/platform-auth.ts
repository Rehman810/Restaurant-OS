import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { PlatformRole } from "@prisma/client";
import { basePrisma } from "../lib/prisma-base";
import { platformJwtSecret } from "../lib/platform/jwt-secret";
import { readPlatformSessionCookie } from "../lib/platform/platform-cookies";
import { platformHasPermission, type PlatformPermission } from "../lib/platform/permissions";

const SECRET = platformJwtSecret();

export type PlatformAuthUser = {
  id: string;
  email: string;
  name: string;
  role: PlatformRole;
  tv?: number;
};

declare global {
  namespace Express {
    interface Request {
      platformUser?: PlatformAuthUser;
    }
  }
}

function bearerOrPlatformCookie(req: Request) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return readPlatformSessionCookie(req.headers.cookie);
}

export function signPlatformToken(user: PlatformAuthUser & { tv: number }) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role, tv: user.tv, typ: "platform" },
    SECRET,
    { expiresIn: "7d" }
  );
}

async function loadPlatformUser(payload: PlatformAuthUser & { tv?: number; typ?: string }) {
  if (payload.typ !== "platform") return null;
  const row = await basePrisma.platformUser.findUnique({
    where: { id: payload.id },
    select: { id: true, email: true, name: true, role: true, isActive: true, tokenVersion: true },
  });
  if (!row?.isActive) return null;
  const tv = typeof payload.tv === "number" ? payload.tv : 0;
  if (tv !== row.tokenVersion) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role, tv: row.tokenVersion };
}

export async function requirePlatformAuth(req: Request, res: Response, next: NextFunction) {
  const token = bearerOrPlatformCookie(req);
  if (!token) {
    return res.status(401).json({ error: "Please sign in to continue." });
  }
  try {
    const payload = jwt.verify(token, SECRET) as PlatformAuthUser & { tv?: number; typ?: string };
    const user = await loadPlatformUser(payload);
    if (!user) {
      return res.status(401).json({ error: "Session expired. Please sign in again." });
    }
    req.platformUser = user;
    next();
  } catch {
    return res.status(401).json({ error: "Session expired. Please sign in again." });
  }
}

export function requirePlatformPermission(...permissions: PlatformPermission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.platformUser;
    if (!user) return res.status(401).json({ error: "Please sign in to continue." });
    const ok = permissions.some((p) => platformHasPermission(user.role, p));
    if (!ok) {
      return res.status(403).json({ error: "You do not have access to this area." });
    }
    next();
  };
}
