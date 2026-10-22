import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { serverApiBase, tenantCacheTag, tenantProxyHeaders } from "@/lib/server-api";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const base = serverApiBase();
  const host = headers().get("host");
  let name = "Restaurant";
  let theme = "#ea580c";
  try {
    const res = await fetch(`${base}/settings/public`, {
      headers: tenantProxyHeaders(host),
      next: { revalidate: 60, tags: [tenantCacheTag("settings-public", host)] },
    });
    if (res.ok) {
      const data = await res.json();
      name = String(data?.settings?.storeName || "").trim() || name;
      theme = String(data?.settings?.primaryColor || "").trim() || theme;
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
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }],
  };
}
