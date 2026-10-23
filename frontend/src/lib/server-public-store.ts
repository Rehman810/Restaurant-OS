import type { PublicStore } from "./types";
import { serverApiBase, tenantCacheTag, tenantProxyHeaders } from "./server-api";

/** Tenant storefront payload for SSR (layout theme, metadata). */
export async function fetchPublicStore(host: string | null): Promise<PublicStore | null> {
  const base = serverApiBase();
  try {
    const res = await fetch(`${base}/settings/public`, {
      headers: tenantProxyHeaders(host),
      next: { revalidate: 30, tags: [tenantCacheTag("settings-public", host)] },
    });
    if (!res.ok) return null;
    return (await res.json()) as PublicStore;
  } catch {
    return null;
  }
}
