/** Server-only API calls from Next (ISR, metadata) with tenant host forwarding. */

export function normalizeStorefrontHost(raw?: string | null): string | null {
  const host = raw?.split(",")[0]?.split(":")[0]?.trim().toLowerCase();
  return host || null;
}

/** Host for tenant resolution: request Host header when set, else STOREFRONT_HOST / Vercel / localhost. */
export function storefrontHost(incoming?: string | null): string {
  const fromRequest = normalizeStorefrontHost(incoming);
  if (fromRequest) return fromRequest;
  const explicit = process.env.STOREFRONT_HOST?.trim();
  if (explicit) return normalizeStorefrontHost(explicit) || "localhost";
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return normalizeStorefrontHost(vercel) || "localhost";
  return "localhost";
}

export function serverApiBase(): string {
  return (process.env.API_PROXY_TARGET || "http://127.0.0.1:4000").replace(/\/$/, "");
}

export function tenantProxyHeaders(incomingHost?: string | null): Record<string, string> {
  const secret = process.env.TENANT_PROXY_SECRET?.trim();
  const host = storefrontHost(incomingHost);
  if (!secret) return {};
  return {
    "x-tenant-host": host,
    "x-tenant-proxy-secret": secret,
  };
}

export function tenantCacheTag(suffix: string, incomingHost?: string | null) {
  return `tenant:${storefrontHost(incomingHost)}:${suffix}`;
}
