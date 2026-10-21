import { api } from "./api";

export const STAFF_PUSH_ENABLED_KEY = "uff-staff-push-enabled";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function readStaffPushEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STAFF_PUSH_ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeStaffPushEnabled(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) localStorage.setItem(STAFF_PUSH_ENABLED_KEY, "1");
    else localStorage.removeItem(STAFF_PUSH_ENABLED_KEY);
  } catch {
    /* ignore */
  }
}

async function ensureServiceWorker() {
  if (!("serviceWorker" in navigator)) throw new Error("Service worker not supported.");
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  return navigator.serviceWorker.register("/store-sw.js", { scope: "/" });
}

export async function subscribeToStaffPush() {
  if (typeof window === "undefined" || !("PushManager" in window)) {
    throw new Error("Push is not supported in this browser.");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notifications blocked in browser settings.");
  }

  const reg = await ensureServiceWorker();
  await navigator.serviceWorker.ready;

  const { publicKey } = await api<{ publicKey: string }>("/admin/notifications/push/vapid-public");
  if (!publicKey) throw new Error("Push is not configured on the server (VAPID keys).");

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const json = sub.toJSON();
  await api("/admin/notifications/push-subscribe", {
    method: "POST",
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
    }),
  });
  writeStaffPushEnabled(true);
}

export async function unsubscribeFromStaffPush() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    writeStaffPushEnabled(false);
    return;
  }
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    const endpoint = sub.endpoint;
    await sub.unsubscribe().catch(() => null);
    await api("/admin/notifications/push-unsubscribe", {
      method: "POST",
      body: JSON.stringify({ endpoint }),
    }).catch(() => null);
  }
  writeStaffPushEnabled(false);
}
