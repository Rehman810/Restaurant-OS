import crypto from "crypto";
import { cookieSecure } from "../session-cookie";

const WEEK_SECONDS = 7 * 24 * 60 * 60;
const LEGACY_SESSION = "ros_platform_session";
const LEGACY_CSRF = "ros_platform_csrf";

export function platformSessionCookieName() {
  return process.env.NODE_ENV === "production" ? "__Host-ros_platform_session" : LEGACY_SESSION;
}

export function platformCsrfCookieName() {
  return process.env.NODE_ENV === "production" ? "__Host-ros_platform_csrf" : LEGACY_CSRF;
}

export function platformSessionCookie(token: string, secure: boolean) {
  const name = platformSessionCookieName();
  const parts = [
    `${name}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${WEEK_SECONDS}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearPlatformSessionCookie(secure: boolean) {
  const name = platformSessionCookieName();
  const parts = [`${name}=`, "HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=0"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function readPlatformSessionCookie(header: string | undefined) {
  if (!header) return null;
  const primary = platformSessionCookieName();
  const names = primary === LEGACY_SESSION ? [primary] : [primary, LEGACY_SESSION];
  for (const name of names) {
    const match = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(header);
    if (match) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function issuePlatformCsrfCookie(res: import("express").Response, secure: boolean) {
  const token = crypto.randomBytes(32).toString("hex");
  const name = platformCsrfCookieName();
  const parts = [`${name}=${encodeURIComponent(token)}`, "Path=/", "Max-Age=86400", "SameSite=Lax"];
  if (secure) parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
  return token;
}

export function readPlatformCsrfCookie(header: string | undefined) {
  if (!header) return null;
  const primary = platformCsrfCookieName();
  const legacy = LEGACY_CSRF;
  const names = primary === legacy ? [primary] : [primary, legacy];
  for (const name of names) {
    const match = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(header);
    if (match) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function platformCookieSecure(protoHeader: string | undefined) {
  return cookieSecure(protoHeader);
}
