import { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { getRestaurantId } from "../lib/restaurant-context";
import { safeErrorForLog } from "../lib/safe-log";

function rateLimitKey(req: Request) {
  let tenant = "unknown";
  try {
    tenant = getRestaurantId();
  } catch {
    tenant = "none";
  }
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  return `${tenant}:${ip}`;
}

export function securityHeaders() {
  return helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    hsts: process.env.NODE_ENV === "production" ? { maxAge: 31536000, includeSubDomains: true } : false,
  });
}

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 400,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  message: { error: "Too many requests. Please wait a moment." },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Try again in a few minutes." },
});

export const trackLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many tracking lookups. Please wait." },
});

export const posLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many POS orders. Slow down." },
});

export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many uploads. Please wait." },
});

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found." });
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof SyntaxError) {
    return res.status(400).json({ error: "Invalid JSON body." });
  }
  console.error(safeErrorForLog(err));
  res.status(500).json({ error: "Something went wrong." });
}

function parseOriginList() {
  const raw = process.env.CLIENT_URL || process.env.FRONTEND_URL || "";
  return raw
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

/** CORS: explicit CLIENT_URL origins. In development, localhost is allowed when no list is set. */
export function allowedOrigins():
  | boolean
  | string[]
  | ((origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void) {
  const list = parseOriginList();
  const allowVercel = process.env.ALLOW_VERCEL_PREVIEWS === "1";

  return (origin, callback) => {
    if (!origin) {
      // Allow same-origin / server-to-server; block anonymous cross-site browser calls in production.
      callback(null, process.env.NODE_ENV !== "production");
      return;
    }
    const normalized = origin.replace(/\/$/, "");
    if (list.includes(normalized)) {
      callback(null, true);
      return;
    }
    try {
      const host = new URL(normalized).hostname;
      const devLocal =
        process.env.NODE_ENV !== "production" &&
        (host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost"));
      if (devLocal) {
        callback(null, true);
        return;
      }
      if (allowVercel && (host.endsWith(".vercel.app") || host === "vercel.app")) {
        callback(null, true);
        return;
      }
    } catch {
      /* ignore */
    }
    callback(null, false);
  };
}
