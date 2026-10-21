"use client";

import { ConfirmSheet } from "@/components/admin/ConfirmSheet";

export type SettingsConflictDiff = Record<string, { yours: unknown; theirs: unknown }>;

export function SettingsConflictSheet({
  open,
  diff,
  onReload,
  onKeepMine,
  onClose,
}: {
  open: boolean;
  diff: SettingsConflictDiff;
  onReload: () => void;
  onKeepMine: () => void;
  onClose: () => void;
}) {
  const entries = Object.entries(diff);
  const detail =
    entries.length > 0
      ? (
          <ul className="mt-3 max-h-48 space-y-2 overflow-auto rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs dark:border-stone-600 dark:bg-stone-800/50">
            {entries.map(([key, { yours, theirs }]) => (
              <li key={key}>
                <span className="font-semibold text-stone-800 dark:text-stone-100">{key}</span>
                <div className="text-stone-600 dark:text-stone-300">Yours: {formatVal(yours)}</div>
                <div className="text-stone-600 dark:text-stone-300">Saved: {formatVal(theirs)}</div>
              </li>
            ))}
          </ul>
        )
      : null;

  return (
    <ConfirmSheet
      open={open}
      title="Someone else changed these settings"
      message={
        <span>
          Another person saved this section while you were editing. You can reload their version or keep your edits and
          save again.
          {detail}
        </span>
      }
      confirmLabel="Reload their version"
      cancelLabel="Keep my edits"
      saving={false}
      onClose={() => {
        onClose();
        onKeepMine();
      }}
      onConfirm={onReload}
    />
  );
}

function formatVal(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
