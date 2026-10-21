import { Request } from "express";

/** Best-effort client IP (respects trust proxy). */
export function clientUserAgent(req: Request): string | null {
  const ua = req.headers["user-agent"];
  if (typeof ua !== "string" || !ua.trim()) return null;
  return ua.trim().slice(0, 512);
}

export function clientIp(req: Request): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim().slice(0, 45);
  }
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) {
    return realIp.trim().slice(0, 45);
  }
  const remote = req.socket.remoteAddress;
  if (!remote) return null;
  return remote.replace(/^::ffff:/, "").slice(0, 45);
}

export function parseCoord(value: unknown, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}
