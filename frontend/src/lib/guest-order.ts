const KEY_PREFIX = "uff_guest_order_";

export function saveGuestOrderToken(orderId: string, token: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(`${KEY_PREFIX}${orderId}`, token);
}

export function getGuestOrderToken(orderId: string) {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(`${KEY_PREFIX}${orderId}`);
}

export function orderApiPath(orderId: string, token?: string | null) {
  if (!token) return `/orders/${orderId}`;
  return `/orders/${orderId}?token=${encodeURIComponent(token)}`;
}

export function orderCancelPath(orderId: string, token?: string | null) {
  if (!token) return `/orders/${orderId}/cancel`;
  return `/orders/${orderId}/cancel?token=${encodeURIComponent(token)}`;
}

export function invoiceApiPath(orderId: string, token?: string | null) {
  if (!token) return `/invoices/${orderId}/download`;
  return `/invoices/${orderId}/download?token=${encodeURIComponent(token)}`;
}

export function orderFeedbackPath(orderId: string, token?: string | null) {
  if (!token) return `/orders/${orderId}/feedback`;
  return `/orders/${orderId}/feedback?token=${encodeURIComponent(token)}`;
}
