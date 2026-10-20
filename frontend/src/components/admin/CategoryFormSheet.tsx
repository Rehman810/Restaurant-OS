"use client";

import {
  ChangeEvent,
  Dispatch,
  FormEvent,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check, ImageIcon, Layers, Loader2, Upload, X } from "lucide-react";

const CLOSE_MS = 340;

export const CATEGORY_WEEKDAYS: { value: number; label: string }[] = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

export type CategoryFormData = {
  name: string;
  tagline: string;
  imageUrl: string;
  isVisible: boolean;
  scheduleDays: number[];
  scheduleStartTime: string;
  scheduleEndTime: string;
};

function BannerImage({ src, alt }: { src: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-stone-100 text-stone-400">
        <ImageIcon size={28} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className="absolute inset-0 h-full w-full object-cover"
      onError={() => setBroken(true)}
    />
  );
}

export function CategoryFormSheet({
  open,
  editingId,
  form,
  setForm,
  saving,
  uploading,
  uploadError,
  onClose,
  onSubmit,
  onImagePick,
}: {
  open: boolean;
  editingId: string | null;
  form: CategoryFormData;
  setForm: Dispatch<SetStateAction<CategoryFormData>>;
  saving: boolean;
  uploading: boolean;
  uploadError: string;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  onImagePick: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setClosing(true);
    setVisible(false);
    window.setTimeout(onClose, CLOSE_MS);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    setClosing(false);
    document.body.style.overflow = "hidden";
    const r1 = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(r1);
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  if (!open) return null;

  const sheet = (
    <div className="fixed inset-0 z-[100] flex justify-end" aria-hidden={closing}>
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className={`drawer-backdrop absolute inset-0 bg-stone-950/60 backdrop-blur-[4px] ${
          visible && !closing ? "opacity-100" : "opacity-0"
        }`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        className={`drawer-panel relative flex h-full w-full max-w-[480px] flex-col rounded-l-2xl bg-white shadow-[-12px_0_48px_rgba(0,0,0,0.2)] ${
          visible && !closing ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-1 shrink-0 rounded-tl-2xl bg-brand-500" />
        <header className="shrink-0 border-b border-stone-100 px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-stone-500">{editingId ? "Edit category" : "New category"}</p>
              <h2 className="mt-0.5 flex items-center gap-2 text-xl font-semibold text-stone-900">
                <Layers size={18} className="text-brand-600" />
                {editingId ? "Edit category banner" : "Create category"}
              </h2>
            </div>
            <button
              type="button"
              onClick={close}
              className="grid h-9 w-9 place-items-center rounded-full border border-stone-200 text-stone-500 hover:bg-stone-100"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-500">Banner image</label>
              <div className="relative aspect-[16/7] overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
                {form.imageUrl ? (
                  <BannerImage src={form.imageUrl} alt="Category banner" />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-stone-400">
                    <ImageIcon size={32} className="opacity-50" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-stone-950/70 via-stone-950/40 to-transparent" />
                <div className="absolute inset-0 flex flex-col justify-end p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-brand-300">
                    {form.tagline || "Tagline preview"}
                  </p>
                  <p className="font-display text-xl text-white">{form.name || "Category name"}</p>
                </div>
                {uploading && (
                  <div className="absolute inset-0 grid place-items-center bg-white/80">
                    <Loader2 size={28} className="animate-spin text-brand-600" />
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onImagePick} />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 py-2.5 text-sm font-semibold text-stone-700 hover:border-brand-300"
              >
                <Upload size={16} /> Upload banner
              </button>
              {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-500">Category name</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                placeholder="e.g. Combos, Breakfast…"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-500">Tagline</label>
              <input
                className="input"
                value={form.tagline}
                onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
                placeholder="e.g. Sweet finish, Ice-cold sips…"
              />
              <p className="mt-1 text-xs text-stone-400">Shown above the category name on the storefront menu.</p>
            </div>

            <div className="space-y-2 rounded-xl border border-stone-200 p-3 dark:border-stone-700">
              <p className="text-xs font-semibold uppercase text-stone-500">Weekly hours (optional)</p>
              <p className="text-xs text-stone-500">Leave days empty to show this category all week.</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_WEEKDAYS.map((d) => {
                  const on = form.scheduleDays.includes(d.value);
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          scheduleDays: on ? f.scheduleDays.filter((x) => x !== d.value) : [...f.scheduleDays, d.value],
                        }))
                      }
                      className={`min-h-10 rounded-full px-3 text-xs font-semibold ring-1 ${
                        on ? "bg-brand-600 text-white ring-brand-600" : "bg-white ring-stone-200 dark:bg-stone-900"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-stone-500">From</label>
                  <input
                    className="input"
                    type="time"
                    value={form.scheduleStartTime}
                    onChange={(e) => setForm((f) => ({ ...f, scheduleStartTime: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-stone-500">Until</label>
                  <input
                    className="input"
                    type="time"
                    value={form.scheduleEndTime}
                    onChange={(e) => setForm((f) => ({ ...f, scheduleEndTime: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, isVisible: !f.isVisible }))}
              className={`flex min-h-11 w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium ${
                form.isVisible ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-stone-200 bg-stone-50 text-stone-600"
              }`}
            >
              <span>{form.isVisible ? "Visible on storefront" : "Hidden from customers"}</span>
              {form.isVisible && <Check size={16} />}
            </button>
          </div>

          <footer className="flex shrink-0 gap-2 border-t border-stone-100 bg-stone-50/80 px-6 py-4">
            <button type="button" onClick={close} className="min-h-11 flex-1 rounded-xl border border-stone-200 text-sm font-semibold">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary min-h-11 flex-1">
              {saving ? "Saving…" : editingId ? "Save category" : "Create category"}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(sheet, document.body);
}
