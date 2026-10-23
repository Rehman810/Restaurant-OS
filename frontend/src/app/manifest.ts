import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { normalizeStoredMediaUrl } from "@/lib/media-url";
import { serverApiBase, tenantCacheTag, tenantProxyHeaders } from "@/lib/server-api";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const base = serverApiBase();
  const host = headers().get("host");
  let name = "Restaurant";
  let theme = "#ea580c";
  let iconSrc = "/icon.svg";
  let iconType = "image/svg+xml";
  try {
    const res = await fetch(`${base}/settings/public`, {
      headers: tenantProxyHeaders(host),
      next: { revalidate: 60, tags: [tenantCacheTag("settings-public", host)] },
    });
    if (res.ok) {
      const data = await res.json();
      name = String(data?.settings?.storeName || "").trim() || name;
      theme = String(data?.settings?.primaryColor || "").trim() || theme;
      const fav = normalizeStoredMediaUrl(String(data?.settings?.faviconUrl || ""));
      if (fav.startsWith("/uploads/")) {
        iconSrc = `/api/proxy${fav}`;
        iconType = fav.endsWith(".webp") ? "image/webp" : fav.endsWith(".png") ? "image/png" : iconType;
      }
    }
  } catch {
    /* fallback */
  }
  return {
    name,
    short_name: name.slice(0, 12),
    description: "Order food online — delivery and takeaway",
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: theme,
    icons: [{ src: iconSrc, sizes: "any", type: iconType, purpose: "maskable" }],
  };
}
