/** Build storefront URL for operators (local dev uses *.localhost). */
export function tenantStorefrontUrl(slug: string, hostname?: string | null) {
  const port = process.env.NEXT_PUBLIC_STOREFRONT_PORT || "3000";
  const host = hostname?.trim() || `${slug}.localhost`;
  const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
  return `${protocol}//${host}:${port}`;
}

export function tenantAdminUrl(slug: string, hostname?: string | null) {
  return `${tenantStorefrontUrl(slug, hostname)}/admin/login`;
}
