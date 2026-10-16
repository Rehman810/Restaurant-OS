import type { Order } from "@/lib/types";
import type { PendingPosOrder } from "./pos-db";

type SyncedOrderPayload = { order: Order; queueItem: PendingPosOrder };

const listeners = new Set<(payload: SyncedOrderPayload) => void>();

export function onPosOrderSynced(listener: (payload: SyncedOrderPayload) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitPosOrderSynced(payload: SyncedOrderPayload) {
  for (const fn of listeners) fn(payload);
}
