import { sessionCookieName } from "./cookie-names";

const WEEK_SECONDS = 7 * 24 * 60 * 60;
const LEGACY_SESSION = "ros_session";

export function sessionCookie(token: string, secure: boolean) {
  const name = sessionCookieName();
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

export function clearSessionCookie(secure: boolean) {
  const name = sessionCookieName();
  const parts = [`${name}=`, "HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=0"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function cookieSecure(protoHeader: string | undefined) {
  if (process.env.NODE_ENV === "production") return true;
  return protoHeader === "https";
}

export function readSessionCookie(header: string | undefined) {
  if (!header) return null;
  const primary = sessionCookieName();
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
