const store = new Map<string, { expires: number; payload: unknown }>();
const DEFAULT_TTL_MS = 45_000;

export function getCached<T>(key: string): T | null {
  const row = store.get(key);
  if (!row) return null;
  if (Date.now() > row.expires) {
    store.delete(key);
    return null;
  }
  return row.payload as T;
}

export function setCached(key: string, payload: unknown, ttlMs = DEFAULT_TTL_MS) {
  store.set(key, { expires: Date.now() + ttlMs, payload });
}

export function cacheKey(parts: Record<string, unknown>) {
  return JSON.stringify(parts);
}
