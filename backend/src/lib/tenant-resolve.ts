import type { Request } from "express";
import { TenantStatus } from "@prisma/client";
import { basePrisma } from "./prisma-base";
import { DEFAULT_RESTAURANT_ID, singleTenantFallbackId } from "./restaurant-context";

const PROXY_SECRET_HEADER = "x-tenant-proxy-secret";
const PROXY_HOST_HEADER = "x-tenant-host";
const DEV_SLUG_HEADER = "x-tenant-slug";
const FORWARDED_HOST_HEADER = "x-forwarded-host";

const hostCache = new Map<string, string>();

export function invalidateTenantHostCache(hostname?: string) {
  if (hostname) {
    const key = normalizeHost(hostname);
    if (key) hostCache.delete(key);
  } else hostCache.clear();
}

function normalizeHost(raw?: string | null): string | null {
  const host = raw?.split(",")[0]?.split(":")[0]?.trim().toLowerCase();
  return host || null;
}

function isLocalHost(host: string | null) {
  return !host || host === "localhost" || host === "127.0.0.1";
}

function trustedProxyHost(req: Request): string | null {
  const secret = (process.env.TENANT_PROXY_SECRET || "").trim();
  if (!secret) return null;
  const provided = String(req.headers[PROXY_SECRET_HEADER] || "").trim();
  if (!provided || provided !== secret) return null;
  return normalizeHost(String(req.headers[PROXY_HOST_HEADER] || ""));
}

function forwardedHost(req: Request): string | null {
  if (process.env.TRUST_FORWARDED_HOST !== "1") return null;
  return normalizeHost(String(req.headers[FORWARDED_HOST_HEADER] || ""));
}

/** Hostname used to resolve the tenant for an HTTP request. */
export function resolveRequestHost(req: Request): string | null {
  const proxied = trustedProxyHost(req);
  if (proxied) return proxied;
  const forwarded = forwardedHost(req);
  if (forwarded) return forwarded;
  return normalizeHost(req.hostname);
}

export function devTenantSlug(req: Request): string | null {
  if (process.env.NODE_ENV === "production") return null;
  const slug = String(req.headers[DEV_SLUG_HEADER] || "").trim().toLowerCase();
  return slug || null;
}

export async function resolveRestaurantIdForHost(hostname?: string | null): Promise<string | null> {
  if (process.env.SINGLE_TENANT_MODE === "true") {
    return process.env.RESTAURANT_ID || DEFAULT_RESTAURANT_ID;
  }
  const host = normalizeHost(hostname);
  const local = isLocalHost(host);
  if (!local && host) {
    const cached = hostCache.get(host);
    if (cached) return cached;
    const domain = await basePrisma.tenantDomain.findUnique({
      where: { hostname: host },
      select: { restaurantId: true },
    });
    if (domain) {
      const tenant = await basePrisma.restaurant.findFirst({
        where: { id: domain.restaurantId, status: { not: TenantStatus.ARCHIVED } },
        select: { id: true },
      });
      if (tenant) {
        hostCache.set(host, tenant.id);
        return tenant.id;
      }
      return null;
    }
    const row = await basePrisma.restaurant.findFirst({
      where: {
        status: { not: TenantStatus.ARCHIVED },
        OR: [{ hostname: host }, { slug: host }],
      },
      select: { id: true },
    });
    if (row) {
      hostCache.set(host, row.id);
      return row.id;
    }
    return null;
  }
  return singleTenantFallbackId();
}

export async function resolveRestaurantIdFromRequest(req: Request): Promise<string | null> {
  if (process.env.SINGLE_TENANT_MODE === "true") {
    return process.env.RESTAURANT_ID || DEFAULT_RESTAURANT_ID;
  }
  const devSlug = devTenantSlug(req);
  if (devSlug) {
    const row = await basePrisma.restaurant.findFirst({
      where: { slug: devSlug, status: { not: TenantStatus.ARCHIVED } },
      select: { id: true },
    });
    if (row) return row.id;
    return null;
  }
  return resolveRestaurantIdForHost(resolveRequestHost(req));
}

/** Socket handshake: same rules as HTTP without an Express request object. */
export async function resolveRestaurantIdFromSocketHeaders(headers: Record<string, unknown>): Promise<string | null> {
  if (process.env.SINGLE_TENANT_MODE === "true") {
    return process.env.RESTAURANT_ID || DEFAULT_RESTAURANT_ID;
  }
  const secret = (process.env.TENANT_PROXY_SECRET || "").trim();
  const provided = String(headers[PROXY_SECRET_HEADER] || headers[PROXY_SECRET_HEADER.toLowerCase()] || "").trim();
  const proxiedHost =
    secret && provided === secret
      ? normalizeHost(String(headers[PROXY_HOST_HEADER] || headers[PROXY_HOST_HEADER.toLowerCase()] || ""))
      : null;
  if (process.env.NODE_ENV !== "production") {
    const slug = String(headers[DEV_SLUG_HEADER] || headers[DEV_SLUG_HEADER.toLowerCase()] || "")
      .trim()
      .toLowerCase();
    if (slug) {
      const row = await basePrisma.restaurant.findFirst({ where: { slug }, select: { id: true } });
      if (row) return row.id;
      return null;
    }
  }
  const host =
    proxiedHost ||
    (process.env.TRUST_FORWARDED_HOST === "1"
      ? normalizeHost(String(headers[FORWARDED_HOST_HEADER] || headers[FORWARDED_HOST_HEADER.toLowerCase()] || ""))
      : null) ||
    normalizeHost(String(headers.host || ""));
  return resolveRestaurantIdForHost(host);
}
