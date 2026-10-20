"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2, X } from "lucide-react";
import type { AdminCategoryRow } from "@/lib/admin-menu/types";

const CLOSE_MS = 340;

type Props = {
  open: boolean;
  target: AdminCategoryRow | null;
  otherCategories: AdminCategoryRow[];
  saving: boolean;
  error: string;
  onClose: () => void;
  onConfirm: (moveToCategoryId: string | undefined) => void;
};

export function CategoryDeleteSheet({ open, target, otherCategories, saving, error, onClose, onConfirm }: Props) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [moveToId, setMoveToId] = useState("");

  const needsMove = (target?.dishCount ?? 0) > 0;
  const options = otherCategories.filter((c) => c.id !== target?.id && !c.archivedAt);

  const close = useCallback(() => {
    if (saving) return;
    setClosing(true);
    setVisible(false);
    window.setTimeout(onClose, CLOSE_MS);
  }, [onClose, saving]);

  useEffect(() => {
    if (!open) return;
    setMoveToId(options[0]?.id ?? "");
    setClosing(false);
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close, options]);

  if (!open || !target) return null;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (needsMove && !moveToId) return;
    onConfirm(needsMove ? moveToId : undefined);
  }

  const sheet = (
    <div className="fixed inset-0 z-[110] flex justify-end" aria-hidden={closing}>
      <button type="button" aria-label="Close" onClick={close} className={`drawer-backdrop absolute inset-0 bg-stone-950/60 ${visible && !closing ? "opacity-100" : "opacity-0"}`} />
      <aside
        role="dialog"
        aria-modal="true"
        className={`drawer-panel relative flex h-full w-full max-w-md flex-col rounded-l-2xl bg-white shadow-xl ${
          visible && !closing ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-start justify-between border-b border-stone-100 px-6 py-4">
          <div>
            <p className="flex items-center gap-2 text-lg font-semibold text-stone-900">
              <Trash2 size={18} className="text-red-600" /> Delete category?
            </p>
            <p className="mt-1 text-sm text-stone-600">
              <span className="font-medium">{target.name}</span> will be removed permanently.
            </p>
          </div>
          <button type="button" onClick={close} className="grid h-9 w-9 place-items-center rounded-full border border-stone-200">
            <X size={18} />
          </button>
        </header>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {needsMove ? (
              <>
                <p className="text-sm text-stone-700">
                  {target.dishCount} dish{target.dishCount === 1 ? "" : "es"} use this category. Move them to:
                </p>
                <select
                  className="input w-full"
                  value={moveToId}
                  onChange={(e) => setMoveToId(e.target.value)}
                  required
                >
                  {options.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {options.length === 0 && (
                  <p className="text-sm text-amber-800">Create another category before deleting this one.</p>
                )}
              </>
            ) : (
              <p className="text-sm text-stone-600">No dishes are assigned to this category.</p>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <footer className="flex gap-2 border-t border-stone-100 px-6 py-4">
            <button type="button" onClick={close} disabled={saving} className="min-h-11 flex-1 rounded-xl border border-stone-200 text-sm font-semibold">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || (needsMove && (!moveToId || options.length === 0))}
              className="min-h-11 flex-1 rounded-xl bg-red-600 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Deleting…" : "Delete"}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(sheet, document.body);
}
