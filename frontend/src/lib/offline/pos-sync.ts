import { api } from "@/lib/api";
import type { Order } from "@/lib/types";
import {
  listCashQueue,
  listQueue,
  pendingQueueCount,
  updateCashQueueItem,
  updateQueueItem,
  type PendingCashMovement,
  type PendingPosOrder,
} from "./pos-db";
import { emitPosOrderSynced } from "./pos-sync-events";

const BASE_DELAY_MS = 1500;
const MAX_DELAY_MS = 60_000;

function backoffMs(attempts: number) {
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1));
}

export type SyncProgress = {
  syncing: boolean;
  pending: number;
  failed: number;
  conflicts: number;
};

let syncLock = false;

export async function getSyncProgress(): Promise<SyncProgress> {
  const all = await listQueue();
  const pending = all.filter((q) => q.status === "pending" || q.status === "syncing").length;
  const failed = all.filter((q) => q.status === "failed").length;
  return { syncing: syncLock, pending, failed, conflicts: 0 };
}

async function syncCashQueue() {
  const items = (await listCashQueue())
    .filter((q) => q.status === "pending" || q.status === "failed")
    .sort((a, b) => a.clientCreatedAt.localeCompare(b.clientCreatedAt));

  for (const item of items) {
    if (!navigator.onLine) break;
    const syncing: PendingCashMovement = { ...item, status: "syncing" };
    await updateCashQueueItem(syncing);
    try {
      await api("/pos/sync/cash-movement", {
        method: "POST",
        body: JSON.stringify(item),
      });
      await updateCashQueueItem({ ...item, status: "synced" });
    } catch (err) {
      const attempts = item.attempts + 1;
      await updateCashQueueItem({
        ...item,
        status: "failed",
        attempts,
        lastError: err instanceof Error ? err.message : "Sync failed",
      });
      await new Promise((r) => setTimeout(r, backoffMs(attempts)));
    }
  }
}

export async function syncPosQueue(onProgress?: (p: SyncProgress) => void): Promise<void> {
  if (syncLock || !navigator.onLine) return;
  syncLock = true;
  try {
    await syncCashQueue();
    const items = (await listQueue())
      .filter((q) => q.status === "pending" || q.status === "failed")
      .sort((a, b) => a.clientCreatedAt.localeCompare(b.clientCreatedAt));

    for (const item of items) {
      if (!navigator.onLine) break;
      const syncing: PendingPosOrder = { ...item, status: "syncing" };
      await updateQueueItem(syncing);
      onProgress?.(await getSyncProgress());

      try {
        const res = await api<{ order: Order; created: boolean; conflict: boolean }>("/pos/sync", {
          method: "POST",
          body: JSON.stringify({
            ...item.body,
            clientOrderId: item.clientOrderId,
            offlineLabel: item.offlineLabel,
            clientCreatedAt: item.clientCreatedAt,
            deviceLabel: item.deviceLabel,
            clientClaimedTotal: item.clientClaimedTotal,
          }),
        });
        const syncedItem = {
          ...item,
          status: "synced" as const,
          syncedOrderId: res.order.id,
          syncedOrderNumber: res.order.orderNumber,
          lastError: res.conflict ? "Synced — needs manager review" : undefined,
        };
        await updateQueueItem(syncedItem);
        if (res.created) {
          emitPosOrderSynced({ order: res.order, queueItem: syncedItem });
        }
      } catch (err) {
        const attempts = item.attempts + 1;
        const message = err instanceof Error ? err.message : "Sync failed";
        await updateQueueItem({
          ...item,
          status: "failed",
          attempts,
          lastError: message,
        });
        await new Promise((r) => setTimeout(r, backoffMs(attempts)));
      }
      onProgress?.(await getSyncProgress());
    }
  } finally {
    syncLock = false;
    onProgress?.(await getSyncProgress());
  }
}

export function startAutoSync(onProgress?: (p: SyncProgress) => void) {
  const tick = () => {
    if (navigator.onLine) void syncPosQueue(onProgress);
  };
  window.addEventListener("online", tick);
  const id = window.setInterval(tick, 45_000);
  return () => {
    window.removeEventListener("online", tick);
    window.clearInterval(id);
  };
}

export async function registerBackgroundSync() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sync = (reg as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } }).sync;
    if (sync) await sync.register("pos-queue-sync");
  } catch {
    /* Background Sync unsupported (e.g. some Safari builds) */
  }
}

export { pendingQueueCount };
