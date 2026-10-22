import { getRestaurantId } from "../restaurant-context";

type Entry = { version: number; payload: unknown };

const byTenant = new Map<string, Entry>();

function bucket() {
  return getRestaurantId();
}

export function bumpDeliveryAreasPublicCache() {
  const tenant = bucket();
  const prev = byTenant.get(tenant);
  byTenant.set(tenant, { version: (prev?.version ?? 0) + 1, payload: null });
}

export function getDeliveryAreasCacheVersion() {
  const tenant = bucket();
  return byTenant.get(tenant)?.version ?? 0;
}

export function readDeliveryAreasPublicCache<T>(currentVersion: number): T | null {
  const tenant = bucket();
  const row = byTenant.get(tenant);
  if (row && row.payload != null && row.version === currentVersion) {
    return row.payload as T;
  }
  return null;
}

export function writeDeliveryAreasPublicCache<T>(currentVersion: number, payload: T) {
  const tenant = bucket();
  byTenant.set(tenant, { version: currentVersion, payload });
}
