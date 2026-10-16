"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const CLOSE_MS = 340;

export function InputSheet({
  open,
  title,
  label,
  placeholder,
  initialValue = "",
  confirmLabel = "Save",
  saving,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  label: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  saving: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [value, setValue] = useState(initialValue);

  const close = useCallback(() => {
    if (saving) return;
    setClosing(true);
    setVisible(false);
    window.setTimeout(onClose, CLOSE_MS);
  }, [onClose, saving]);

  useEffect(() => {
    if (!open) return;
    setValue(initialValue);
    setClosing(false);
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, initialValue, close]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  }

  if (!open && !closing) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[200] flex items-end justify-center sm:items-center p-0 sm:p-4 ${
        visible ? "opacity-100" : "opacity-0"
      } transition-opacity duration-300`}
      role="presentation"
    >
      <button type="button" className="absolute inset-0 bg-stone-950/50 backdrop-blur-sm" aria-label="Close" onClick={close} />
      <div
        className={`relative w-full max-w-md rounded-t-3xl border border-stone-200 bg-white p-5 shadow-2xl dark:border-stone-600 dark:bg-stone-900 sm:rounded-3xl ${
          visible ? "translate-y-0" : "translate-y-4"
        } transition-transform duration-300`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="input-sheet-title"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="input-sheet-title" className="text-lg font-semibold text-stone-900 dark:text-stone-50">{title}</h2>
          <button
            type="button"
            onClick={close}
            className="grid h-9 w-9 place-items-center rounded-full text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</span>
            <input
              className="input dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              autoFocus
            />
          </label>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={saving || !value.trim()}>
            {saving ? "Saving…" : confirmLabel}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
