"use client";

import { Dispatch, FormEvent, SetStateAction, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Building2, MapPin, Phone, Plus, Save, X } from "lucide-react";
import type { CopyFromOptions } from "@/modules/branches/types";
import { mapsUrl } from "@/lib/branches/helpers";

const CLOSE_MS = 340;

export type BranchFormData = {
  name: string;
  code: string;
  addressLine: string;
  area: string;
  city: string;
  phone: string;
  email: string;
  latitude: string;
  longitude: string;
  managerUserId: string;
  acceptsOnlineOrders: boolean;
  isDefault: boolean;
  copyFromBranchId: string;
  copyOptions: CopyFromOptions;
};

export function BranchFormSheet({
  open,
  mode,
  form,
  setForm,
  saving,
  error,
  codeLocked,
  branchOptions,
  managerOptions,
  isAdmin,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  form: BranchFormData;
  setForm: Dispatch<SetStateAction<BranchFormData>>;
  saving: boolean;
  error: string;
  codeLocked?: boolean;
  branchOptions: { id: string; name: string }[];
  managerOptions: { id: string; name: string }[];
  isAdmin: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

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

  const lat = form.latitude ? Number(form.latitude) : null;
  const lng = form.longitude ? Number(form.longitude) : null;
  const mapLink = mapsUrl(lat, lng);

  const sheet = (
    <div className="fixed inset-0 z-[100] flex justify-end max-lg:items-end lg:justify-end" aria-hidden={closing}>
      <button type="button" aria-label="Close" onClick={close} className={`drawer-backdrop absolute inset-0 bg-stone-950/60 backdrop-blur-[4px] ${visible && !closing ? "opacity-100" : "opacity-0"}`} />
      <aside
        role="dialog"
        aria-modal="true"
        className={`drawer-panel relative flex h-full w-full max-h-[96dvh] flex-col rounded-t-2xl bg-white shadow-2xl dark:bg-stone-900 max-lg:pb-[env(safe-area-inset-bottom)] lg:max-h-full lg:max-w-[480px] lg:rounded-l-2xl lg:rounded-tr-none ${visible && !closing ? "translate-y-0 lg:translate-x-0" : "translate-y-full lg:translate-x-full"}`}
      >
        <div className="h-1 shrink-0 rounded-t-2xl bg-brand-500 lg:rounded-tl-2xl" />
        <header className="shrink-0 border-b border-stone-100 px-5 py-4 dark:border-stone-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-stone-500">{mode === "create" ? "New branch" : "Edit branch"}</p>
              <h2 className="mt-0.5 flex items-center gap-2 text-xl font-semibold text-stone-900 dark:text-stone-50">
                <Building2 size={18} className="text-brand-600" />
                {mode === "create" ? "Add branch" : "Edit branch"}
              </h2>
            </div>
            <button type="button" onClick={close} className="grid h-11 w-11 min-h-[44px] min-w-[44px] place-items-center rounded-full border border-stone-200 dark:border-stone-700">
              <X size={18} />
            </button>
          </div>
        </header>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-600">Branch name</label>
              <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-600">Code</label>
              <input
                className="input font-mono uppercase"
                value={form.code}
                disabled={codeLocked}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="MAIN"
              />
              {codeLocked && <p className="mt-1 text-xs text-stone-500">Code is fixed after the first order at this branch.</p>}
            </div>
            <div className="grid gap-3 sm:grid-cols-1">
              <input className="input" placeholder="Street address" value={form.addressLine} onChange={(e) => setForm((f) => ({ ...f, addressLine: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2">
                <input className="input" placeholder="Area" value={form.area} onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))} />
                <input className="input" placeholder="City" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder="Latitude" value={form.latitude} onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))} />
              <input className="input" placeholder="Longitude" value={form.longitude} onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))} />
            </div>
            {mapLink && (
              <a href={mapLink} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-300">
                Preview on map
              </a>
            )}
            <div>
              <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-stone-600"><Phone size={12} /> Phone</label>
              <input className="input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-600">Email</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            {mode === "edit" && managerOptions.length > 0 && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-stone-600">Manager</label>
                <select className="input" value={form.managerUserId} onChange={(e) => setForm((f) => ({ ...f, managerUserId: e.target.value }))}>
                  <option value="">None</option>
                  {managerOptions.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}
            <label className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 px-3 py-3 dark:border-stone-700">
              <span className="text-sm font-medium">Accept online orders</span>
              <input type="checkbox" checked={form.acceptsOnlineOrders} onChange={(e) => setForm((f) => ({ ...f, acceptsOnlineOrders: e.target.checked }))} />
            </label>
            {isAdmin && mode === "create" && branchOptions.length > 0 && (
              <div className="rounded-xl border border-stone-200 p-3 dark:border-stone-700">
                <p className="text-sm font-semibold">Copy setup from another branch</p>
                <select className="input mt-2" value={form.copyFromBranchId} onChange={(e) => setForm((f) => ({ ...f, copyFromBranchId: e.target.value }))}>
                  <option value="">Skip</option>
                  {branchOptions.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                {form.copyFromBranchId && (
                  <div className="mt-2 space-y-1 text-sm">
                    {(
                      [
                        ["menuAvailability", "Menu availability"],
                        ["printStations", "Print stations"],
                        ["tables", "Tables & floors"],
                        ["deliveryAreas", "Delivery areas"],
                        ["openingHours", "Opening hours"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(form.copyOptions[key])}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              copyOptions: { ...f.copyOptions, [key]: e.target.checked },
                            }))
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
            {isAdmin && (
              <label className="flex items-start gap-3 rounded-xl border border-stone-200 px-3 py-3 dark:border-stone-700">
                <input type="checkbox" className="mt-1" checked={form.isDefault} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} />
                <span className="text-sm">Set as default branch</span>
              </label>
            )}
            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-200">{error}</p>}
          </div>
          <footer className="shrink-0 border-t border-stone-100 px-5 py-4 dark:border-stone-800">
            <button type="submit" disabled={saving} className="btn-primary min-h-[44px] w-full">
              {mode === "create" ? <Plus size={16} /> : <Save size={16} />}
              {saving ? "Saving…" : mode === "create" ? "Create branch" : "Save changes"}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(sheet, document.body);
}
