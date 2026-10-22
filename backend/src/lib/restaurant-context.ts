import { AsyncLocalStorage } from "async_hooks";

/** Stable id inserted by the white-label migration. Tenant #1. */
export const DEFAULT_RESTAURANT_ID = "11111111-1111-4111-8111-111111111111";

export class TenantContextError extends Error {
  code = "TENANT_CONTEXT_REQUIRED";
  constructor(message = "A restaurant context is required for this operation.") {
    super(message);
    this.name = "TenantContextError";
  }
}

type Store =
  | { mode: "tenant"; restaurantId: string }
  | { mode: "bypass"; reason: string };

const als = new AsyncLocalStorage<Store>();

/**
 * SINGLE_TENANT_MODE=true uses RESTAURANT_ID (or the original restaurant) when no
 * request context is set. Production defaults this off: an unset flag does not fall back.
 * Outside production, an unset flag still falls back so local scripts keep working.
 * SINGLE_TENANT_MODE=false disables the fallback in every environment.
 */
export function singleTenantFallbackId(): string | null {
  const flag = process.env.SINGLE_TENANT_MODE;
  if (flag === "true") return process.env.RESTAURANT_ID || DEFAULT_RESTAURANT_ID;
  if (flag === "false") return null;
  if (process.env.NODE_ENV === "production") return null;
  return process.env.RESTAURANT_ID || DEFAULT_RESTAURANT_ID;
}

export function getRestaurantId(): string {
  const store = als.getStore();
  if (store?.mode === "tenant") return store.restaurantId;
  if (store?.mode === "bypass") {
    throw new TenantContextError("Tenant context is bypassed. Use a platform query, not a tenant query.");
  }
  const fallback = singleTenantFallbackId();
  if (fallback) return fallback;
  throw new TenantContextError();
}

export function isTenantBypass(): boolean {
  return als.getStore()?.mode === "bypass";
}

export function runWithRestaurant<T>(id: string, fn: () => T): T {
  if (!id) throw new TenantContextError("Missing restaurant id.");
  // The callback must start the Prisma call itself. An async callback keeps this
  // store alive across awaits. A sync callback that only returns a promise drops it.
  return als.run({ mode: "tenant", restaurantId: id }, fn);
}

/** Platform and other cross-tenant work. Every call site is allowlisted by tenancy:check. */
export function withoutTenant<T>(reason: string, fn: () => T): T {
  if (!reason.trim()) throw new Error("withoutTenant requires a reason.");
  return als.run({ mode: "bypass", reason: reason.trim() }, fn);
}
