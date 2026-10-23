import { NextFunction, Request, Response } from "express";
import { readPlatformCsrfCookie, readPlatformSessionCookie } from "../lib/platform/platform-cookies";

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

function csrfExempt(path: string) {
  if (
    path === "/platform/auth/login" ||
    path === "/platform/auth/login/2fa" ||
    path === "/platform/auth/csrf"
  ) {
    return true;
  }
  return false;
}

export function platformCsrfProtection(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith("/platform")) return next();
  if (SAFE.has(req.method) || csrfExempt(req.path)) return next();
  if (req.headers.authorization?.startsWith("Bearer ")) return next();

  const session = readPlatformSessionCookie(req.headers.cookie);
  if (!session) return next();

  const expected = readPlatformCsrfCookie(req.headers.cookie);
  const provided = String(req.headers["x-csrf-token"] || "");
  if (!expected || !provided || expected !== provided) {
    return res.status(403).json({ error: "Invalid or missing CSRF token. Refresh the page and try again." });
  }
  next();
}
