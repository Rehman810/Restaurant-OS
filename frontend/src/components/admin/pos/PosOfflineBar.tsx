"use client";

import { useCallback, useEffect, useState } from "react";
import { Cloud, CloudOff, RefreshCw, ListOrdered, Download } from "lucide-react";
import { ConfirmSheet } from "@/components/admin/ConfirmSheet";
import {
  getSnapshotMeta,
  isIndexedDbAvailable,
  listQueue,
  removeQueueItem,
  type PendingPosOrder,
  type PosSnapshotMeta,
} from "@/lib/offline/pos-db";
import { getSyncProgress, syncPosQueue, startAutoSync } from "@/lib/offline/pos-sync";
import { api } from "@/lib/api";
import { getDeviceLabel, setDeviceLabel } from "@/lib/offline/device-label";

type Props = {
  conflictCount?: number;
};

function formatSyncedAt(iso: string | null) {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleString("en-PK", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function PosOfflineBar({ conflictCount = 0 }: Props) {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [meta, setMeta] = useState<PosSnapshotMeta | null>(null);
  const [progress, setProgress] = useState({ syncing: false, pending: 0, failed: 0, conflicts: 0 });
  const [queueOpen, setQueueOpen] = useState(false);
  const [queue, setQueue] = useState<PendingPosOrder[]>([]);
  const [discardId, setDiscardId] = useState<string | null>(null);
  const [installHint, setInstallHint] = useState(false);
  const [deviceLabel, setDeviceLabelState] = useState("");
  const idbOk = isIndexedDbAvailable();

  useEffect(() => {
    setDeviceLabelState(getDeviceLabel());
  }, []);

  const refresh = useCallback(async () => {
    setMeta(await getSnapshotMeta());
    setProgress(await getSyncProgress());
    setQueue(await listQueue());
  }, []);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    void refresh();
    const stop = startAutoSync(() => {
      void refresh();
    });
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      stop();
    };
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = localStorage.getItem("pos-pwa-install-dismissed");
    if (dismissed) return;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone;
    if (!isStandalone && "BeforeInstallPromptEvent" in window) {
      setInstallHint(true);
    }
  }, []);

  async function syncNow() {
    await syncPosQueue(() => void refresh());
    await refresh();
  }

  async function discardQueueItem(id: string) {
    const item = queue.find((q) => q.clientOrderId === id);
    if (item) {
      await api("/pos/offline-discard", {
        method: "POST",
        body: JSON.stringify({
          clientOrderId: id,
          offlineLabel: item.offlineLabel,
          deviceLabel: item.deviceLabel,
        }),
      }).catch(() => null);
    }
    await removeQueueItem(id);
    setDiscardId(null);
    await refresh();
  }

  const statusLabel = !idbOk
    ? "Online only"
    : !online
      ? "Offline"
      : progress.syncing || progress.pending > 0
        ? `Syncing ${progress.pending}`
        : "Online";

  const chipClass =
    !idbOk
      ? "bg-amber-100 text-amber-900 ring-amber-200"
      : !online
        ? "bg-stone-800 text-amber-200 ring-stone-600"
        : progress.pending > 0
          ? "bg-sky-100 text-sky-900 ring-sky-200"
          : progress.failed > 0 || conflictCount > 0
            ? "bg-rose-100 text-rose-900 ring-rose-200"
            : "bg-emerald-100 text-emerald-900 ring-emerald-200";

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            setQueueOpen(true);
            void refresh();
          }}
          className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold ring-1 sm:text-[11px] ${chipClass}`}
          title={meta ? `Menu synced ${formatSyncedAt(meta.menuSyncedAt)}` : undefined}
        >
          {!online || !idbOk ? <CloudOff size={12} /> : <Cloud size={12} />}
          {statusLabel}
          {(progress.failed > 0 || conflictCount > 0) && (
            <span className="rounded bg-white/60 px-1">{progress.failed + conflictCount} conflicts</span>
          )}
        </button>
        {online && idbOk && (progress.pending > 0 || progress.failed > 0) && (
          <button
            type="button"
            onClick={() => void syncNow()}
            className="grid h-7 w-7 place-items-center rounded-lg bg-white text-stone-600 ring-1 ring-stone-200 dark:bg-stone-800 dark:text-stone-200 dark:ring-stone-600"
            title="Sync now"
          >
            <RefreshCw size={14} className={progress.syncing ? "animate-spin" : ""} />
          </button>
        )}
        {installHint && (
          <button
            type="button"
            onClick={() => {
              localStorage.setItem("pos-pwa-install-dismissed", "1");
              setInstallHint(false);
            }}
            className="hidden items-center gap-1 rounded-lg bg-brand-600 px-2 py-1 text-[10px] font-bold text-white sm:flex"
            title="Install POS app from browser menu"
          >
            <Download size={12} /> Install POS
          </button>
        )}
      </div>

      {queueOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-stone-900">
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3 dark:border-stone-700">
              <div className="flex items-center gap-2">
                <ListOrdered size={18} className="text-brand-600" />
                <p className="font-bold text-stone-900 dark:text-stone-50">Offline queue</p>
              </div>
              <button type="button" className="text-sm font-semibold text-stone-500" onClick={() => setQueueOpen(false)}>
                Close
              </button>
            </div>
            <div className="border-b border-stone-100 px-4 py-2 text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400">
              <label className="block">
                Device label
                <input
                  className="input mt-1 w-full text-sm"
                  value={deviceLabel}
                  onChange={(e) => setDeviceLabelState(e.target.value)}
                  onBlur={() => setDeviceLabel(deviceLabel)}
                />
              </label>
              <p className="mt-2">Last menu sync: {formatSyncedAt(meta?.menuSyncedAt ?? null)}</p>
              {!idbOk && <p className="mt-1 font-semibold text-amber-700">IndexedDB unavailable — online-only mode.</p>}
            </div>
            <ul className="max-h-64 overflow-y-auto px-2 py-2">
              {queue.filter((q) => q.status !== "synced").length === 0 ? (
                <li className="px-2 py-6 text-center text-sm text-stone-500">No pending items.</li>
              ) : (
                queue
                  .filter((q) => q.status !== "synced")
                  .map((q) => (
                    <li
                      key={q.clientOrderId}
                      className="mb-2 rounded-xl border border-stone-200 px-3 py-2 text-sm dark:border-stone-700"
                    >
                      <div className="flex justify-between font-bold text-stone-900 dark:text-stone-50">
                        <span>{q.offlineLabel}</span>
                        <span className="text-xs uppercase text-stone-500">{q.status}</span>
                      </div>
                      <p className="text-xs text-stone-500">{q.clientCreatedAt}</p>
                      {q.lastError && <p className="mt-1 text-xs text-rose-600">{q.lastError}</p>}
                      {q.status === "failed" && (
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            className="rounded-lg bg-brand-600 px-2 py-1 text-xs font-bold text-white"
                            onClick={() => void syncNow()}
                          >
                            Retry
                          </button>
                          <button
                            type="button"
                            className="rounded-lg px-2 py-1 text-xs font-bold text-rose-600 ring-1 ring-rose-200"
                            onClick={() => setDiscardId(q.clientOrderId)}
                          >
                            Discard
                          </button>
                        </div>
                      )}
                    </li>
                  ))
              )}
            </ul>
            {online && idbOk && (
              <div className="border-t border-stone-200 p-3 dark:border-stone-700">
                <button type="button" className="btn-primary w-full" onClick={() => void syncNow()}>
                  Sync now
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmSheet
        open={discardId != null}
        title="Discard queued order?"
        message="This removes the offline order from this device. It will not be sent to the kitchen unless you recreate it."
        confirmLabel="Discard"
        danger
        saving={false}
        onConfirm={() => discardId && void discardQueueItem(discardId)}
        onClose={() => setDiscardId(null)}
      />
    </>
  );
}
