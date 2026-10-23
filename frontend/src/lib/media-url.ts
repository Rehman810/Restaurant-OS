import { getApiUrl } from "./api";

/** Match backend `normalizeStoredMediaUrl` for saves and uploads. */
export function normalizeStoredMediaUrl(value: string): string {
  let v = value.trim();
  if (!v) return v;
  if (v.startsWith("/api/proxy")) v = v.slice("/api/proxy".length) || "/";
  if (!v.startsWith("/") && !/^https?:\/\//i.test(v)) {
    if (v.startsWith("uploads/")) v = `/${v}`;
  }
  if (v.startsWith("/")) return v.split(/\s/)[0]!;
  try {
    const u = new URL(v);
    if (u.pathname.startsWith("/uploads/")) return u.pathname;
    if (u.protocol === "http:") {
      u.protocol = "https:";
      return u.href;
    }
    return u.href;
  } catch {
    return v;
  }
}

/** Turn stored image paths into URLs the browser can load. */
export function resolveMediaUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/uploads/")) {
    const apiBase = getApiUrl().replace(/\/$/, "");
    return `${apiBase}${trimmed}`;
  }
  if (trimmed.startsWith("/api/proxy/uploads/")) return trimmed;
  return trimmed;
}

export function isLocalPublicAsset(url: string) {
  const resolved = resolveMediaUrl(url);
  return resolved.startsWith("/") && !resolved.startsWith("/uploads");
}
