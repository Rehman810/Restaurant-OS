import { NextFunction, Request, Response } from "express";
import { getMaintenanceState } from "../lib/platform/maintenance";

const SKIP_PREFIXES = ["/health", "/platform", "/uploads"];

export async function maintenanceMiddleware(req: Request, res: Response, next: NextFunction) {
  if (SKIP_PREFIXES.some((p) => req.path === p || req.path.startsWith(`${p}/`))) {
    return next();
  }
  const m = await getMaintenanceState();
  if (!m.active) return next();
  const read = req.method === "GET" || req.method === "HEAD";
  if (read) return next();
  if (req.method === "POST" && /\/admin\/announcements\/[^/]+\/dismiss$/.test(req.path)) {
    return next();
  }
  return res.status(503).json({ error: m.message, code: "MAINTENANCE" });
}
