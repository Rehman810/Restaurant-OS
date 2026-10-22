import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { jwtSecret } from "../lib/jwt-secret";
import { prisma } from "../lib/prisma";
import { getRestaurantId } from "../lib/restaurant-context";
import { readSessionCookie } from "../lib/session-cookie";
import { verifySupportAccessToken } from "../lib/platform/support-access";

const JWT_SECRET = jwtSecret();

export type AuthUser = { id: string; role: Role; email: string; name: string; tv?: number; rid?: string };

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      supportAccess?: boolean;
    }
  }
}

export function signToken(user: AuthUser & { rid: string }) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email, name: user.name, tv: user.tv ?? 0, rid: user.rid },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function bearerOrCookie(req: Request) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return readSessionCookie(req.headers.cookie);
}

async function loadActiveUser(payload: AuthUser & { tv?: number; rid?: string }): Promise<AuthUser | null> {
  const account = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { isActive: true, role: true, email: true, name: true, tokenVersion: true, restaurantId: true },
  });
  if (!account?.isActive) return null;
  const tv = typeof payload.tv === "number" ? payload.tv : 0;
  if (tv !== account.tokenVersion) return null;
  const tenantId = getRestaurantId();
  if (account.restaurantId !== tenantId) return null;
  if (payload.rid && payload.rid !== account.restaurantId) return null;
  return {
    id: payload.id,
    role: account.role,
    email: account.email,
    name: account.name,
    tv: account.tokenVersion,
    rid: account.restaurantId,
  };
}

async function resolveRequestUser(req: Request, token: string): Promise<AuthUser | null> {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser & { typ?: string };
    if (payload.typ === "support") {
      const verified = await verifySupportAccessToken(token);
      if (!verified) return null;
      const tenantId = getRestaurantId();
      if (verified.rid !== tenantId) return null;
      req.supportAccess = true;
      return {
        id: `support:${verified.sid}`,
        role: Role.ADMIN,
        email: verified.email,
        name: verified.name,
        rid: verified.rid,
      };
    }
    return loadActiveUser(payload);
  } catch {
    return null;
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = bearerOrCookie(req);
  if (token) {
    const user = await resolveRequestUser(req, token);
    if (user) req.user = user;
  }
  next();
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = bearerOrCookie(req);
  if (!token) {
    return res.status(401).json({ error: "Please sign in to continue." });
  }
  const user = await resolveRequestUser(req, token);
  if (!user) {
    return res.status(401).json({ error: "Session expired. Please sign in again." });
  }
  req.user = user;
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have access to this area." });
    }
    next();
  };
}
