"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Star,
  Users,
} from "lucide-react";
import { createBranch, fetchAdminBranches, updateBranch } from "@/modules/branches/api";
import type { Branch } from "@/modules/branches/types";
import { useBranch } from "@/modules/branches/BranchContext";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { BranchFormSheet, type BranchFormData } from "@/components/admin/BranchFormSheet";
import { ConfirmSheet } from "@/components/admin/ConfirmSheet";
import {
  AdminAlert,
  AdminEmptyState,
  AdminKpiCard,
  AdminKpiGrid,
  AdminPage,
  AdminPageHeader,
} from "@/components/admin/ui";

const emptyForm: BranchFormData = { name: "", code: "", address: "", phone: "", isDefault: false };

function branchToForm(b: Branch): BranchFormData {
  return {
    name: b.name,
    code: b.code,
    address: b.address || "",
    phone: b.phone || "",
    isDefault: b.isDefault,
  };
}

export default function BranchesPage() {
  const { refresh: refreshContext } = useBranch();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Branch | null>(null);
  const [form, setForm] = useState<BranchFormData>(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<Branch | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const stats = useMemo(() => {
    const active = branches.filter((b) => b.isActive).length;
    const staff = branches.reduce((sum, b) => sum + (b._count?.members ?? 0), 0);
    return { total: branches.length, active, staff };
  }, [branches]);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const data = await fetchAdminBranches();
      setBranches(data.branches);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load branches");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm);
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(branch: Branch) {
    setEditTarget(branch);
    setForm(branchToForm(branch));
    setFormError("");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditTarget(null);
    setForm(emptyForm);
    setFormError("");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setFormError("");
    try {
      if (editTarget) {
        await updateBranch(editTarget.id, {
          name: form.name.trim(),
          code: form.code.trim() || undefined,
          address: form.address.trim(),
          phone: form.phone.trim(),
          isDefault: form.isDefault,
        });
        setMsg("Branch updated.");
      } else {
        await createBranch({
          name: form.name.trim(),
          code: form.code.trim() || undefined,
          address: form.address.trim(),
          phone: form.phone.trim(),
          isDefault: form.isDefault,
        });
        setMsg("Branch created.");
      }
      closeForm();
      await load(true);
      await refreshContext();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save branch");
    } finally {
      setSaving(false);
    }
  }

  async function setDefault(branch: Branch) {
    setError("");
    try {
      await updateBranch(branch.id, { isDefault: true });
      setMsg(`${branch.name} is now the default branch.`);
      await load(true);
      await refreshContext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update branch");
    }
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    setDeactivating(true);
    setError("");
    try {
      await updateBranch(deactivateTarget.id, { isActive: false });
      setMsg(`${deactivateTarget.name} deactivated.`);
      setDeactivateTarget(null);
      await load(true);
      await refreshContext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not deactivate branch");
    } finally {
      setDeactivating(false);
    }
  }

  async function activate(branch: Branch) {
    setError("");
    try {
      await updateBranch(branch.id, { isActive: true });
      setMsg(`${branch.name} is active again.`);
      await load(true);
      await refreshContext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not activate branch");
    }
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="Branches"
        description="Each outlet has its own kitchen queue, POS, and orders. Use the header switcher to filter the admin panel."
        icon={Building2}
        actions={
          <>
            <RefreshButton busy={loading || refreshing} onClick={() => load(true)} />
            <button type="button" onClick={openCreate} className="btn-primary">
              <Plus size={16} /> Add branch
            </button>
          </>
        }
      />

      <AdminKpiGrid className="sm:grid-cols-3 xl:grid-cols-3">
        <AdminKpiCard label="Outlets" value={stats.total} icon={Building2} accent="brand" />
        <AdminKpiCard label="Active" value={stats.active} icon={Star} accent="amber" />
        <AdminKpiCard label="Staff assigned" value={stats.staff} icon={Users} accent="sky" />
      </AdminKpiGrid>

      {msg && (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          {msg}
        </p>
      )}

      {error && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="skeleton h-44 rounded-2xl" />
          <div className="skeleton h-44 rounded-2xl" />
        </div>
      ) : branches.length === 0 ? (
        <AdminEmptyState
          icon={Building2}
          title="No branches yet"
          description="Add your first outlet to run multi-location kitchen and POS."
          action={
            <button type="button" onClick={openCreate} className="btn-primary">
              <Plus size={16} /> Add branch
            </button>
          }
        />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {branches.map((b) => (
            <li
              key={b.id}
              className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition dark:bg-stone-900 ${
                b.isDefault && b.isActive
                  ? "border-brand-200 ring-1 ring-brand-100 dark:border-brand-800 dark:ring-brand-900/50"
                  : "border-stone-200/80 dark:border-stone-700"
              } ${!b.isActive ? "opacity-75" : ""}`}
            >
              <div className="border-b border-stone-100 bg-gradient-to-r from-stone-50/80 to-white px-4 py-3 dark:border-stone-800 dark:from-stone-800/40 dark:to-stone-900">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md">
                      <Building2 size={20} />
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-semibold text-stone-900 dark:text-stone-50">
                        <span className="truncate">{b.name}</span>
                        {b.isDefault && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                            <Star size={10} /> Default
                          </span>
                        )}
                        {!b.isActive && (
                          <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-bold uppercase text-stone-600 dark:bg-stone-700 dark:text-stone-300">
                            Inactive
                          </span>
                        )}
                      </p>
                      <p className="text-xs font-medium text-stone-500 dark:text-stone-400">Code: {b.code}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEdit(b)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-stone-200 px-2.5 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
                  >
                    <Pencil size={13} /> Edit
                  </button>
                </div>
              </div>

              <div className="space-y-3 px-4 py-4">
                {b.address ? (
                  <p className="flex gap-2 text-sm text-stone-600 dark:text-stone-300">
                    <MapPin size={16} className="mt-0.5 shrink-0 text-stone-400" />
                    <span>{b.address}</span>
                  </p>
                ) : (
                  <p className="text-sm text-stone-400">No address set</p>
                )}
                {b.phone ? (
                  <p className="flex gap-2 text-sm text-stone-600 dark:text-stone-300">
                    <Phone size={16} className="shrink-0 text-stone-400" />
                    <a href={`tel:${b.phone}`} className="hover:text-brand-600">{b.phone}</a>
                  </p>
                ) : (
                  <p className="text-sm text-stone-400">No phone set</p>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                    {b._count?.members ?? 0} staff assigned
                  </span>
                  <Link
                    href="/admin/staff"
                    className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800 hover:bg-brand-100 dark:bg-brand-950/50 dark:text-brand-200"
                  >
                    Manage staff →
                  </Link>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-stone-100 bg-stone-50/50 px-4 py-3 dark:border-stone-800 dark:bg-stone-800/30">
                {!b.isDefault && b.isActive && (
                  <button
                    type="button"
                    className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-200"
                    onClick={() => setDefault(b)}
                  >
                    Make default
                  </button>
                )}
                {b.isActive ? (
                  <button
                    type="button"
                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
                    onClick={() => setDeactivateTarget(b)}
                  >
                    Deactivate
                  </button>
                ) : (
                  <button
                    type="button"
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                    onClick={() => activate(b)}
                  >
                    Activate
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {formOpen && (
        <BranchFormSheet
          open={formOpen}
          mode={editTarget ? "edit" : "create"}
          form={form}
          setForm={setForm}
          saving={saving}
          error={formError}
          onClose={closeForm}
          onSubmit={onSubmit}
        />
      )}

      <ConfirmSheet
        open={Boolean(deactivateTarget)}
        title={`Deactivate ${deactivateTarget?.name ?? "branch"}?`}
        message="New orders won't be routed here. Staff can stay assigned; reactivate anytime. You cannot deactivate the default branch without choosing another default first."
        confirmLabel="Deactivate"
        danger
        saving={deactivating}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => void confirmDeactivate()}
      />
    </AdminPage>
  );
}
