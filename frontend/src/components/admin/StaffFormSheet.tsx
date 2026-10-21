"use client";

import {
  Dispatch,
  FormEvent,
  SetStateAction,
  useCallback,
  useEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Bike, Briefcase, ChefHat, Plus, Receipt, UserPlus, UserRound, X } from "lucide-react";
import { Role } from "@/lib/types";
import { BranchSelectField, type BranchSelectOption } from "@/components/admin/BranchSelectField";
import { ASSIGNABLE_ROLES } from "./StaffTable";

const CLOSE_MS = 340;

export type StaffFormData = {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: Role;
  autoGeneratePassword: boolean;
  sendInvite: boolean;
  branchIds: string[];
};

const ROLE_ICONS = {
  MANAGER: Briefcase,
  WAITER: UserRound,
  CHEF: ChefHat,
  RIDER: Bike,
  CASHIER: Receipt,
} as const;

export function StaffFormSheet({
  open,
  form,
  setForm,
  branches,
  saving,
  error,
  onClose,
  onSubmit,
  mode = "create",
  roleOptions,
}: {
  open: boolean;
  form: StaffFormData;
  setForm: Dispatch<SetStateAction<StaffFormData>>;
  branches: BranchSelectOption[];
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  mode?: "create" | "edit";
  roleOptions?: { value: Role; label: string }[];
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
        aria-label={mode === "edit" ? "Edit staff member" : "Add staff member"}
        className={`drawer-panel relative flex h-full w-full max-w-[440px] flex-col rounded-l-2xl bg-white shadow-[-12px_0_48px_rgba(0,0,0,0.2)] ${
          visible && !closing ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-1 shrink-0 rounded-tl-2xl bg-brand-500" />
        <header className="shrink-0 border-b border-stone-100 px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-stone-500">{mode === "edit" ? "Update profile" : "New account"}</p>
              <h2 className="mt-0.5 flex items-center gap-2 text-xl font-semibold text-stone-900">
                <UserPlus size={18} className="text-brand-600" />
                {mode === "edit" ? "Edit staff member" : "Add staff member"}
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
              <label className="mb-1.5 block text-xs font-medium text-stone-500">Full name</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                placeholder="e.g. Chef Ali"
              />
            </div>
            {mode === "create" && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-stone-500">Email (login)</label>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                  placeholder="chef@email.com"
                />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-500">Phone</label>
              <input
                className="input"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="03xx-xxxxxxx"
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-stone-500">Branch</p>
              <BranchSelectField
                value={form.branchIds[0] ?? ""}
                branches={branches}
                onChange={(id) => setForm((f) => ({ ...f, branchIds: [id] }))}
              />
              <p className="mt-1.5 text-xs text-stone-400">
                Staff only see data for this outlet. Set role when creating the account; branches are shown as text in the staff list.
              </p>
            </div>
            {mode === "create" && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-stone-500">Role</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(roleOptions ?? ASSIGNABLE_ROLES).map((role) => {
                  const Icon = ROLE_ICONS[role.value as keyof typeof ROLE_ICONS] ?? ChefHat;
                  const active = form.role === role.value;
                  return (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, role: role.value }))}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-semibold transition ${
                        active
                          ? "border-brand-400 bg-brand-50 text-brand-800 ring-2 ring-brand-100"
                          : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
                      }`}
                    >
                      <Icon size={16} />
                      {role.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-stone-400">
                Riders are created here. They show up on the Riders page after the account exists.
              </p>
            </div>
            )}
            {mode === "create" && (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-3 text-sm text-stone-700">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-stone-300 text-brand-600"
                checked={form.sendInvite}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sendInvite: e.target.checked, autoGeneratePassword: e.target.checked }))
                }
              />
              <span>Send email invite to set their own password (recommended)</span>
            </label>
            )}
            {mode === "create" && !form.sendInvite && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-stone-500">Password</label>
                <input
                  className="input"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Min 6 characters"
                  minLength={6}
                  required
                />
              </div>
            )}
            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          </div>
          <footer className="shrink-0 border-t border-stone-100 bg-stone-50/80 px-6 py-4">
            <button type="submit" disabled={saving} className="btn-primary w-full min-h-[44px]">
              <Plus size={16} />
              {saving ? (mode === "edit" ? "Saving…" : "Creating…") : mode === "edit" ? "Save changes" : "Create account"}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(sheet, document.body);
}
