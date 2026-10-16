import { api } from "@/lib/api";
import { getDeviceLabel } from "./device-label";
import { pendingQueueCount } from "./pos-db";

export async function hasPendingOfflineQueue() {
  return (await pendingQueueCount()) > 0;
}

export async function auditOfflineLogoutOverride(pendingCount?: number) {
  const count = pendingCount ?? (await pendingQueueCount());
  await api("/pos/offline-logout-override", {
    method: "POST",
    body: JSON.stringify({ pendingCount: count, deviceLabel: getDeviceLabel() }),
  });
}
