"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { History, X } from "lucide-react";
import { api } from "@/lib/api";
import type { SettingsSectionId } from "@/modules/settings/ia";

export type SettingsHistoryEntry = {
  id: string;
  createdAt: string;
  actorName: string;
  actorRole: string | null;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  changedKeys: string[];
  restorable: boolean;
};

export function SettingsHistoryDrawer({
  open,
  sectionId,
  onClose,
  onRestore,
}: {
  open: boolean;
  sectionId: SettingsSectionId;
  onClose: () => void;
  onRestore: (entry: SettingsHistoryEntry) => void;
}) {
  const [entries, setEntries] = useState<SettingsHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    api<{ entries: SettingsHistoryEntry[] }>(`/settings/sections/${sectionId}/history`)
      .then((data) => setEntries(data.entries))
      .catch(() => setError("Could not load change history."))
      .finally(() => setLoading(false));
  }, [open, sectionId]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end">
      <button type="button" className="absolute inset-0 bg-stone-900/40" aria-label="Close" onClick={onClose} />
      <aside
        className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl dark:bg-stone-900"
        role="dialog"
        aria-labelledby="settings-history-title"
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3 dark:border-stone-700">
          <div className="flex items-center gap-2">
            <History size={18} aria-hidden />
            <h2 id="settings-history-title" className="font-display text-lg font-bold text-stone-900 dark:text-stone-50">
              Change history
            </h2>
          </div>
          <button type="button" className="grid h-10 w-10 place-items-center rounded-full hover:bg-stone-100" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {loading && <p className="text-sm text-stone-500">Loading…</p>}
          {error && <p className="text-sm text-red-700">{error}</p>}
          {!loading && !error && entries.length === 0 && (
            <p className="text-sm text-stone-500">No saved changes for this section yet.</p>
          )}
          <ul className="space-y-3">
            {entries.map((entry) => (
              <li key={entry.id} className="rounded-2xl border border-stone-200 p-3 dark:border-stone-700">
                <p className="text-xs text-stone-500">
                  {new Date(entry.createdAt).toLocaleString()} · {entry.actorName}
                </p>
                <ul className="mt-2 space-y-1 text-xs text-stone-700 dark:text-stone-200">
                  {entry.changedKeys.map((key) => (
                    <li key={key}>
                      <span className="font-semibold">{key}</span>: {formatVal(entry.before[key])} → {formatVal(entry.after[key])}
                    </li>
                  ))}
                </ul>
                {entry.restorable && (
                  <button
                    type="button"
                    className="mt-3 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
                    onClick={() => onRestore(entry)}
                  >
                    Restore these values
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>,
    document.body
  );
}

function formatVal(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
