import { readFile } from "fs/promises";
import path from "path";
import { headers } from "next/headers";
import { serverApiBase, tenantCacheTag, tenantProxyHeaders } from "@/lib/server-api";
import { normalizeStoredMediaUrl } from "@/lib/media-url";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

async function fallbackIcon() {
  const svg = await readFile(path.join(process.cwd(), "public/icon.svg"));
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml" } });
}

/** Tab favicon (name ke sath top par) — tenant `faviconUrl` ya default SVG. */
export default async function Icon() {
  const host = headers().get("host");
  const base = serverApiBase();
  try {
    const pub = await fetch(`${base}/settings/public`, {
      headers: tenantProxyHeaders(host),
      next: { revalidate: 60, tags: [tenantCacheTag("settings-public", host)] },
    });
    if (!pub.ok) return fallbackIcon();
    const data = await pub.json();
    const raw = String(data?.settings?.faviconUrl || "").trim();
    const stored = raw ? normalizeStoredMediaUrl(raw) : "";
    if (!stored.startsWith("/uploads/")) return fallbackIcon();

    const imgRes = await fetch(`${base}${stored}`, {
      headers: tenantProxyHeaders(host),
      next: { revalidate: 300 },
    });
    if (!imgRes.ok) return fallbackIcon();
    const buf = await imgRes.arrayBuffer();
    const ct = imgRes.headers.get("content-type") || "image/webp";
    return new Response(buf, { headers: { "Content-Type": ct } });
  } catch {
    return fallbackIcon();
  }
}
