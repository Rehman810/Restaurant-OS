import { normalizeBlockPhone } from "./blocklist";

/** Last 10 digits used to merge guest checkouts (03xx, +92, 92xx formats). */
export function customerPhoneMatchKey(phone: unknown): string | null {
  return normalizeBlockPhone(phone);
}

/** WhatsApp wa.me digits: 03001234567 → 923001234567 */
export function pkPhoneForWhatsApp(phone: unknown): string | null {
  const key = normalizeBlockPhone(phone);
  if (!key) return null;
  return `92${key}`;
}
