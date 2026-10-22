import { NextFunction, Request, Response } from "express";
import { readCsrfCookie } from "../lib/csrf-cookie";
import { readSessionCookie } from "../lib/session-cookie";

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

/** Paths that accept cookie sessions without a CSRF header (sign-in, public booking). */
function csrfExempt(path: string) {
  if (path.startsWith("/auth/login") || path === "/auth/register" || path === "/auth/forgot-password") {
    return true;
  }
  if (path === "/auth/reset-password" || path.startsWith("/auth/login/2fa")) return true;
  if (path.startsWith("/dine-in/")) return true;
  if (path === "/health") return true;
  return false;
}

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Platform panel uses its own cookies/CSRF; localhost shares cookies across ports with the tenant app.
  if (req.path.startsWith("/platform")) return next();
  if (SAFE.has(req.method) || csrfExempt(req.path)) return next();
  if (req.headers.authorization?.startsWith("Bearer ")) return next();

  const session = readSessionCookie(req.headers.cookie);
  if (!session) return next();

  const expected = readCsrfCookie(req.headers.cookie);
  const provided = String(req.headers["x-csrf-token"] || "");
  if (!expected || !provided || expected !== provided) {
    return res.status(403).json({ error: "Invalid or missing CSRF token. Refresh the page and try again." });
  }
  next();
}
