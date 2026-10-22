import crypto from "crypto";
import { csrfCookieName } from "./cookie-names";

const LEGACY_CSRF = "ros_csrf";
const DAY_SECONDS = 24 * 60 * 60;

export function issueCsrfCookie(res: import("express").Response, secure: boolean) {
  const token = crypto.randomBytes(32).toString("hex");
  const name = csrfCookieName();
  const parts = [
    `${name}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${DAY_SECONDS}`,
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
  return token;
}

export function readCsrfCookie(header: string | undefined) {
  if (!header) return null;
  const primary = csrfCookieName();
  const names = primary === LEGACY_CSRF ? [primary] : [primary, LEGACY_CSRF];
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

export function clearCsrfCookie(secure: boolean) {
  const name = csrfCookieName();
  const parts = [`${name}=`, "Path=/", "Max-Age=0", "SameSite=Lax"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}
