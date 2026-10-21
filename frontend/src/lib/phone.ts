/** Mirrors backend `normalizePkPhone` — applied on save server-side; use on blur in admin for preview. */
/** Last 10 digits for matching guest checkouts (03xx, +92, 92xx). */
export function pkPhoneMatchKey(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

/** wa.me link digits: 0300… → 92300… */
export function pkPhoneForWhatsApp(input: string): string | null {
  const key = pkPhoneMatchKey(input);
  if (!key) return null;
  return `92${key}`;
}

export function normalizePkPhone(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("92")) return `+${digits}`;
  if (digits.startsWith("0")) return `+92${digits.slice(1)}`;
  return `+92${digits}`;
}

export function mapsDirectionsUrl(latitude: unknown, longitude: unknown): string | null {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
