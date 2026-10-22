let version = 0;
let cachedPayload: unknown = null;
let cachedVersion = -1;

export function bumpDeliveryAreasPublicCache() {
  version += 1;
  cachedPayload = null;
}

export function getDeliveryAreasCacheVersion() {
  return version;
}

export function readDeliveryAreasPublicCache<T>(currentVersion: number): T | null {
  if (cachedPayload != null && cachedVersion === currentVersion) {
    return cachedPayload as T;
  }
  return null;
}

export function writeDeliveryAreasPublicCache<T>(currentVersion: number, payload: T) {
  cachedVersion = currentVersion;
  cachedPayload = payload;
}
