import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Deal, MenuItem } from "@/lib/types";

export type QueueItemStatus = "pending" | "syncing" | "failed" | "synced";

export type PendingCashMovement = {
  clientMovementId: string;
  type: "PAID_IN" | "PAID_OUT";
  amount: number;
  reason: string;
  clientCreatedAt: string;
  deviceLabel: string;
  status: QueueItemStatus;
  attempts: number;
  lastError?: string;
};

export type PendingPosOrder = {
  clientOrderId: string;
  offlineLabel: string;
  clientCreatedAt: string;
  deviceLabel: string;
  clientClaimedTotal: number;
  body: Record<string, unknown>;
  status: QueueItemStatus;
  attempts: number;
  lastError?: string;
  syncedOrderId?: string;
  syncedOrderNumber?: string;
};

export type PosSnapshotMeta = {
  menuSyncedAt: string | null;
  dealsSyncedAt: string | null;
  settingsSyncedAt: string | null;
  shiftSyncedAt: string | null;
};

type PosDbSchema = DBSchema & {
  queue: { key: string; value: PendingPosOrder; indexes: { byStatus: string } };
  cashQueue: { key: string; value: PendingCashMovement };
  snapshots: {
    key: "menu" | "deals" | "settings" | "shift";
    value: unknown;
  };
  meta: { key: string; value: unknown };
};

const DB_NAME = "restaurant-pos-offline";
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<PosDbSchema>> | null = null;
let idbUnavailable = false;

export function isIndexedDbAvailable() {
  return typeof indexedDB !== "undefined" && !idbUnavailable;
}

export async function getPosDb(): Promise<IDBPDatabase<PosDbSchema> | null> {
  if (!isIndexedDbAvailable()) return null;
  if (!dbPromise) {
    dbPromise = openDB<PosDbSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains("queue")) {
          const queue = db.createObjectStore("queue", { keyPath: "clientOrderId" });
          queue.createIndex("byStatus", "status");
        }
        if (!db.objectStoreNames.contains("snapshots")) db.createObjectStore("snapshots");
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
        if (oldVersion < 2 && !db.objectStoreNames.contains("cashQueue")) {
          db.createObjectStore("cashQueue", { keyPath: "clientMovementId" });
        }
      },
    }).catch((err) => {
      idbUnavailable = true;
      console.warn("IndexedDB unavailable", err);
      return null as never;
    });
  }
  try {
    return await dbPromise;
  } catch {
    idbUnavailable = true;
    return null;
  }
}

export async function saveMenuSnapshot(items: MenuItem[]) {
  const db = await getPosDb();
  if (!db) return;
  const at = new Date().toISOString();
  await db.put("snapshots", items, "menu");
  await db.put("meta", at, "menuSyncedAt");
}

export async function loadMenuSnapshot(): Promise<MenuItem[] | null> {
  const db = await getPosDb();
  if (!db) return null;
  return (await db.get("snapshots", "menu")) as MenuItem[] | undefined ?? null;
}

export async function saveDealsSnapshot(deals: Deal[]) {
  const db = await getPosDb();
  if (!db) return;
  await db.put("snapshots", deals, "deals");
  await db.put("meta", new Date().toISOString(), "dealsSyncedAt");
}

export async function loadDealsSnapshot(): Promise<Deal[] | null> {
  const db = await getPosDb();
  if (!db) return null;
  return (await db.get("snapshots", "deals")) as Deal[] | undefined ?? null;
}

export async function saveShiftSnapshot(shift: unknown) {
  const db = await getPosDb();
  if (!db) return;
  await db.put("snapshots", shift, "shift");
  await db.put("meta", new Date().toISOString(), "shiftSyncedAt");
}

export async function loadShiftSnapshot(): Promise<unknown | null> {
  const db = await getPosDb();
  if (!db) return null;
  return (await db.get("snapshots", "shift")) ?? null;
}

export async function getSnapshotMeta(): Promise<PosSnapshotMeta> {
  const db = await getPosDb();
  if (!db) {
    return { menuSyncedAt: null, dealsSyncedAt: null, settingsSyncedAt: null, shiftSyncedAt: null };
  }
  const [menuSyncedAt, dealsSyncedAt, settingsSyncedAt, shiftSyncedAt] = await Promise.all([
    db.get("meta", "menuSyncedAt"),
    db.get("meta", "dealsSyncedAt"),
    db.get("meta", "settingsSyncedAt"),
    db.get("meta", "shiftSyncedAt"),
  ]);
  return {
    menuSyncedAt: (menuSyncedAt as string) ?? null,
    dealsSyncedAt: (dealsSyncedAt as string) ?? null,
    settingsSyncedAt: (settingsSyncedAt as string) ?? null,
    shiftSyncedAt: (shiftSyncedAt as string) ?? null,
  };
}

let offlineCounter = 0;

export async function nextOfflineLabel(): Promise<string> {
  const db = await getPosDb();
  const key = "offlineSeq";
  if (!db) {
    offlineCounter += 1;
    return `OFF-${String(offlineCounter).padStart(4, "0")}`;
  }
  const current = Number((await db.get("meta", key)) ?? 0);
  const next = current + 1;
  await db.put("meta", next, key);
  return `OFF-${String(next).padStart(4, "0")}`;
}

export async function enqueuePosOrder(entry: PendingPosOrder) {
  const db = await getPosDb();
  if (!db) throw new Error("Offline storage unavailable.");
  await db.put("queue", entry);
  const { registerBackgroundSync } = await import("./pos-sync");
  void registerBackgroundSync();
}

export async function listQueue(): Promise<PendingPosOrder[]> {
  const db = await getPosDb();
  if (!db) return [];
  return db.getAll("queue");
}

export async function updateQueueItem(entry: PendingPosOrder) {
  const db = await getPosDb();
  if (!db) return;
  await db.put("queue", entry);
}

export async function removeQueueItem(clientOrderId: string) {
  const db = await getPosDb();
  if (!db) return;
  await db.delete("queue", clientOrderId);
}

export async function pendingQueueCount(): Promise<number> {
  const [orders, cash] = await Promise.all([listQueue(), listCashQueue()]);
  const orderN = orders.filter((q) => q.status === "pending" || q.status === "failed" || q.status === "syncing").length;
  const cashN = cash.filter((q) => q.status === "pending" || q.status === "failed" || q.status === "syncing").length;
  return orderN + cashN;
}

export async function enqueueCashMovement(entry: PendingCashMovement) {
  const db = await getPosDb();
  if (!db) throw new Error("Offline storage unavailable.");
  await db.put("cashQueue", entry);
}

export async function listCashQueue(): Promise<PendingCashMovement[]> {
  const db = await getPosDb();
  if (!db) return [];
  return db.getAll("cashQueue");
}

export async function updateCashQueueItem(entry: PendingCashMovement) {
  const db = await getPosDb();
  if (!db) return;
  await db.put("cashQueue", entry);
}

export async function removeCashQueueItem(clientMovementId: string) {
  const db = await getPosDb();
  if (!db) return;
  await db.delete("cashQueue", clientMovementId);
}
