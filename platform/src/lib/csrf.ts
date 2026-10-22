const CSRF_COOKIE = process.env.NODE_ENV === "production" ? "__Host-ros_platform_csrf" : "ros_platform_csrf";

export function readCsrfFromDocument() {
  if (typeof document === "undefined") return "";
  const match = new RegExp(`(?:^|;\\s*)${CSRF_COOKIE}=([^;]+)`).exec(document.cookie);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return "";
  }
}
