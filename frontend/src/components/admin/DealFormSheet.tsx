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
import { Check, ImageIcon, Loader2, Plus, Sparkles, Trash2, Upload, X } from "lucide-react";
import { MenuItem } from "@/lib/types";
import { pkr } from "@/lib/format";
import { AdminSelect } from "./AdminSelect";
import { CATEGORY_WEEKDAYS } from "./CategoryFormSheet";

const CLOSE_MS = 340;

export type DealFormData = {
  title: string;
  description: string;
  category: string;
  dealPrice: string;
  imageUrl: string;
  isVisible: boolean;
  channelOnline: boolean;
  channelPos: boolean;
  channelDineIn: boolean;
  perOrderLimit: string;
  scheduleStartsAt: string;
  scheduleEndsAt: string;
  scheduleStartTime: string;
  scheduleEndTime: string;
  scheduleDays: number[];
  items: { menuItemId: string; quantity: number }[];
};

function DealImage({ src, alt }: { src: string; alt: string }) {
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

export function DealFormSheet({
  open,
  editingId,
  form,
  setForm,
  menuItems,
  saving,
  uploading,
  uploadError,
  categoryOptions,
  onClose,
  onSubmit,
  onImagePick,
}: {
  open: boolean;
  editingId: string | null;
  form: DealFormData;
  setForm: Dispatch<SetStateAction<DealFormData>>;
  menuItems: MenuItem[];
  saving: boolean;
  uploading: boolean;
  uploadError: string;
  categoryOptions: string[];
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

  const dishOptions = menuItems.map((m) => ({
    value: m.id,
    label: `${m.name} — ${pkr(m.price)}`,
  }));

  const regularTotal = form.items.reduce((sum, row) => {
    const item = menuItems.find((m) => m.id === row.menuItemId);
    return sum + (item ? Number(item.price) * row.quantity : 0);
  }, 0);

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
        <div className="h-1 shrink-0 rounded-tl-2xl bg-brand-600" />
        <header className="shrink-0 border-b border-stone-100 px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-stone-500">{editingId ? "Edit offer" : "New offer"}</p>
              <h2 className="mt-0.5 flex items-center gap-2 text-xl font-semibold text-stone-900 dark:text-stone-50">
                <Sparkles size={18} className="text-brand-600" />
                {editingId ? "Update combo offer" : "Create combo offer"}
              </h2>
              <p className="mt-1 text-sm text-stone-500">Bundle dishes at a set price for online, POS, and dine-in.</p>
            </div>
            <button type="button" onClick={close} className="grid h-9 w-9 place-items-center rounded-full border border-stone-200 text-stone-500 hover:bg-stone-100">
              <X size={18} />
            </button>
          </div>
        </header>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-500">Offer image</label>
              <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
                {form.imageUrl ? <DealImage src={form.imageUrl} alt="Deal" /> : (
                  <div className="absolute inset-0 grid place-items-center text-stone-400">
                    <ImageIcon size={32} className="opacity-50" />
                  </div>
                )}
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
                <Upload size={16} /> Upload image
              </button>
              {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-500">Offer title</label>
              <input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required placeholder="e.g. Family Feast" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-500">Offer group</label>
              <input
                className="input"
                list="deal-category-suggestions"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Summer deals"
              />
              <datalist id="deal-category-suggestions">
                {categoryOptions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <p className="mt-1 text-xs text-stone-500">Separate from dish categories — e.g. Family packs, Ramadan specials.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-500">Description</label>
              <textarea className="input min-h-[72px] resize-none" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What's included in this offer?" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-500">Offer price</label>
              <input className="input" type="number" min={0} value={form.dealPrice} onChange={(e) => setForm((f) => ({ ...f, dealPrice: e.target.value }))} required />
              {regularTotal > 0 && form.dealPrice && (
                <div className="mt-2 space-y-1 text-xs">
                  <p className="text-stone-600 dark:text-stone-400">
                    Components {pkr(regularTotal)} · Save {pkr(Math.max(0, regularTotal - Number(form.dealPrice)))}
                  </p>
                  {Number(form.dealPrice) >= regularTotal && regularTotal > 0 && (
                    <p className="font-semibold text-amber-800 dark:text-amber-200">Offer price is at or above the item total.</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-medium text-stone-500">Items in this offer</label>
                <button
                  type="button"
                  disabled={menuItems.length === 0}
                  onClick={() => setForm((f) => ({ ...f, items: [...f.items, { menuItemId: menuItems[0]?.id || "", quantity: 1 }] }))}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={14} /> Add item
                </button>
              </div>
              {menuItems.length === 0 ? (
                <p className="rounded-xl border border-dashed border-stone-200 bg-stone-50 px-3 py-4 text-center text-xs text-stone-500">
                  Add dishes to the menu first, then include them in an offer.
                </p>
              ) : (
              <ul className="space-y-2">
                {form.items.map((row, idx) => (
                  <li
                    key={idx}
                    className="grid grid-cols-[minmax(0,1fr)_3.5rem_2.5rem] items-center gap-2"
                  >
                    <div className="min-w-0">
                      <AdminSelect
                        className="w-full"
                        minWidth="w-full"
                        value={row.menuItemId}
                        onChange={(menuItemId) =>
                          setForm((f) => ({
                            ...f,
                            items: f.items.map((r, i) => (i === idx ? { ...r, menuItemId } : r)),
                          }))
                        }
                        options={dishOptions}
                        placeholder="Select dish…"
                        aria-label={`Deal item ${idx + 1}`}
                      />
                    </div>
                    <input
                      type="number"
                      min={1}
                      className="input w-full py-2 text-center text-sm text-stone-800"
                      value={row.quantity}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          items: f.items.map((r, i) => (i === idx ? { ...r, quantity: Number(e.target.value) || 1 } : r)),
                        }))
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}
                      className="grid h-10 w-10 place-items-center rounded-xl text-red-500 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
              )}
            </div>

            <div className="space-y-2 rounded-xl border border-stone-200 p-3 dark:border-stone-700">
              <p className="text-xs font-semibold uppercase text-stone-500">Channels</p>
              {[
                { key: "channelOnline" as const, label: "Online storefront" },
                { key: "channelPos" as const, label: "POS" },
                { key: "channelDineIn" as const, label: "Dine-in" },
              ].map((ch) => (
                <label key={ch.key} className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form[ch.key]}
                    onChange={(e) => setForm((f) => ({ ...f, [ch.key]: e.target.checked }))}
                    className="h-4 w-4 accent-brand-600"
                  />
                  {ch.label}
                </label>
              ))}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-500">Per-order limit (optional)</label>
              <input className="input" type="number" min={1} value={form.perOrderLimit} onChange={(e) => setForm((f) => ({ ...f, perOrderLimit: e.target.value }))} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-stone-500">Start date</label>
                <input className="input" type="date" value={form.scheduleStartsAt} onChange={(e) => setForm((f) => ({ ...f, scheduleStartsAt: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-stone-500">End date</label>
                <input className="input" type="date" value={form.scheduleEndsAt} onChange={(e) => setForm((f) => ({ ...f, scheduleEndsAt: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-stone-200 p-3 dark:border-stone-700">
              <p className="text-xs font-semibold uppercase text-stone-500">Weekly hours (optional)</p>
              <p className="text-xs text-stone-500">Leave days empty to run this offer every day in the date range.</p>
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
          <footer className="flex shrink-0 gap-2 border-t border-stone-100 bg-stone-50/80 px-6 py-4 dark:border-stone-800">
            <button type="button" onClick={close} className="min-h-11 flex-1 rounded-xl border border-stone-200 text-sm font-semibold dark:border-stone-600">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary min-h-11 flex-1">
              {saving ? "Saving…" : editingId ? "Save offer" : "Create offer"}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(sheet, document.body);
}
