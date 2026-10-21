"use client";

import dynamic from "next/dynamic";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Building2, ChevronDown, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  createBranch,
  deactivateBranch,
  fetchAdminBranches,
  makeBranchDefault,
  reactivateBranch,
  toggleBranchOnlineOrdering,
  updateBranch,
} from "@/modules/branches/api";
import type { AdminBranch, BranchesListRange } from "@/modules/branches/types";
import { useBranch } from "@/modules/branches/BranchContext";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { BranchFormSheet, type BranchFormData } from "@/components/admin/BranchFormSheet";
import { ConfirmSheet } from "@/components/admin/ConfirmSheet";
import { BranchCard } from "@/components/admin/branches/BranchCard";
import { DeactivateBranchSheet } from "@/components/admin/branches/DeactivateBranchSheet";
import {
  AdminAlert,
  AdminEmptyState,
  AdminKpiCard,
  AdminKpiGrid,
  AdminPage,
  AdminPageHeader,
} from "@/components/admin/ui";
import { api } from "@/lib/api";
import { formatMoney, normalizeBranchCodeInput, suggestBranchCodeFromName, validateBranchCodeClient } from "@/lib/branches/helpers";

const BranchesPerformance = dynamic(
  () => import("@/components/admin/branches/BranchesPerformance").then((m) => m.BranchesPerformance),
  { ssr: false, loading: () => <div className="skeleton h-24 rounded-2xl" /> }
);

const emptyForm: BranchFormData = {
  name: "",
  code: "",
  addressLine: "",
  area: "",
  city: "",
  phone: "",
  email: "",
  latitude: "",
  longitude: "",
  managerUserId: "",
  acceptsOnlineOrders: true,
  isDefault: false,
  copyFromBranchId: "",
  copyOptions: {},
};

function checklistDismissed(id: string) {
  try {
    return localStorage.getItem(`branch-checklist-dismissed-${id}`) === "1";
  } catch {
    return false;
  }
}

export default function BranchesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const { refresh: refreshContext, setSelection } = useBranch();
  const [range, setRange] = useState<BranchesListRange>("today");
  const [branches, setBranches] = useState<AdminBranch[]>([]);
  const [meta, setMeta] = useState<{ ms: number; timezone: string } | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [inactiveOpen, setInactiveOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminBranch | null>(null);
  const [form, setForm] = useState<BranchFormData>(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [managerOptions, setManagerOptions] = useState<{ id: string; name: string }[]>([]);

  const [deactivateTarget, setDeactivateTarget] = useState<AdminBranch | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [onlineTarget, setOnlineTarget] = useState<AdminBranch | null>(null);
  const [onlineReason, setOnlineReason] = useState("");
  const [onlineSaving, setOnlineSaving] = useState(false);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const data = await fetchAdminBranches(range);
      setBranches(data.branches);
      setMeta(data.meta);
      setUpdatedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load branches");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!formOpen || editTarget) return;
    if (!form.code && form.name.trim()) {
      setForm((f) => ({ ...f, code: suggestBranchCodeFromName(f.name) }));
    }
  }, [form.name, form.code, formOpen, editTarget]);

  const activeBranches = useMemo(() => branches.filter((b) => b.isActive), [branches]);
  const inactiveBranches = useMemo(() => branches.filter((b) => !b.isActive), [branches]);

  const kpis = useMemo(() => {
    const openNow = activeBranches.filter((b) => b.open.isOpenNow && b.acceptsOnlineOrders).length;
    const collected = activeBranches.reduce((s, b) => s + b.live.collectedToday, 0);
    const inProgress = activeBranches.reduce((s, b) => s + b.live.inProgress, 0);
    return {
      branches: `${activeBranches.length} of ${branches.length}`,
      openNow,
      collected,
      inProgress,
    };
  }, [activeBranches, branches.length]);

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm);
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(b: AdminBranch) {
    setEditTarget(b);
    setForm({
      name: b.name,
      code: b.code,
      addressLine: b.addressLine || b.address || "",
      area: b.area || "",
      city: b.city || "",
      phone: b.phone || "",
      email: b.email || "",
      latitude: b.latitude != null ? String(b.latitude) : "",
      longitude: b.longitude != null ? String(b.longitude) : "",
      managerUserId: b.managerUserId || "",
      acceptsOnlineOrders: b.acceptsOnlineOrders,
      isDefault: b.isDefault,
      copyFromBranchId: "",
      copyOptions: {},
    });
    setFormError("");
    setFormOpen(true);
    void api<{ staff: { id: string; name: string }[] }>(`/admin/staff?limit=100`, {
      headers: { "X-Branch-Id": b.id },
    })
      .then((r) => setManagerOptions(r.staff || []))
      .catch(() => setManagerOptions([]));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const code = normalizeBranchCodeInput(form.code || suggestBranchCodeFromName(form.name));
    const codeErr = validateBranchCodeClient(code);
    if (codeErr) {
      setFormError(codeErr);
      return;
    }
    setSaving(true);
    setFormError("");
    const payload = {
      name: form.name.trim(),
      code,
      addressLine: form.addressLine.trim(),
      area: form.area.trim(),
      city: form.city.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      latitude: form.latitude ? Number(form.latitude) : null,
      longitude: form.longitude ? Number(form.longitude) : null,
      managerUserId: form.managerUserId || null,
      acceptsOnlineOrders: form.acceptsOnlineOrders,
      isDefault: form.isDefault,
      copyFrom:
        form.copyFromBranchId && isAdmin
          ? { sourceBranchId: form.copyFromBranchId, options: form.copyOptions }
          : undefined,
    };
    try {
      if (editTarget) {
        await updateBranch(editTarget.id, payload);
        setMsg("Branch updated.");
      } else {
        await createBranch(payload);
        setMsg("Branch created.");
      }
      setFormOpen(false);
      await load(true);
      await refreshContext();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save branch");
    } finally {
      setSaving(false);
    }
  }

  function deactivateReason(b: AdminBranch): string | null {
    if (b.isDefault) return "Set another default branch first.";
    if (activeBranches.length <= 1 && b.isActive) return "At least one branch must stay active.";
    return null;
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="Branches"
        description="Each branch has its own kitchen queue, POS, orders and stock. Use the branch switcher at the top to focus the admin panel on one branch."
        icon={Building2}
        trailing={
          updatedAt ? (
            <span className="text-xs font-normal text-stone-500">Updated {updatedAt.toLocaleTimeString()}</span>
          ) : null
        }
        actions={
          <>
            <select
              className="input py-2 text-sm"
              value={range}
              onChange={(e) => setRange(e.target.value as BranchesListRange)}
              aria-label="Performance range"
            >
              <option value="today">Today</option>
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
            </select>
            <RefreshButton busy={loading || refreshing} onClick={() => load(true)} />
            {isAdmin && (
              <button type="button" onClick={openCreate} className="btn-primary min-h-[44px]">
                <Plus size={16} /> Add branch
              </button>
            )}
          </>
        }
      />

      <AdminKpiGrid className="grid-cols-2 lg:grid-cols-4">
        <AdminKpiCard compact label="Branches" value={kpis.branches} hint="Active of total" />
        <AdminKpiCard compact label="Open now" value={kpis.openNow} />
        <AdminKpiCard compact label="Sales today" value={formatMoney(kpis.collected)} hint="All branches" />
        <AdminKpiCard compact label="Orders in progress" value={kpis.inProgress} />
      </AdminKpiGrid>

      {msg && <AdminAlert variant="success">{msg}</AdminAlert>}
      {error && <AdminAlert variant="error">{error}</AdminAlert>}
      {meta && isAdmin && <p className="text-xs text-stone-500">Loaded in {meta.ms}ms ({meta.timezone})</p>}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="skeleton h-64 rounded-2xl" />
          <div className="skeleton h-64 rounded-2xl" />
        </div>
      ) : branches.length === 0 ? (
        <AdminEmptyState
          icon={Building2}
          title="No branches yet"
          description="Add your first branch to run multi-location kitchen and POS."
          action={
            isAdmin ? (
              <button type="button" onClick={openCreate} className="btn-primary">
                <Plus size={16} /> Add branch
              </button>
            ) : null
          }
        />
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {activeBranches.map((b) => (
              <BranchCard
                key={b.id}
                branch={b}
                isAdmin={Boolean(isAdmin)}
                checklistDismissed={dismissed[b.id] ?? checklistDismissed(b.id)}
                onDismissChecklist={() => {
                  localStorage.setItem(`branch-checklist-dismissed-${b.id}`, "1");
                  setDismissed((d) => ({ ...d, [b.id]: true }));
                }}
                onEdit={() => openEdit(b)}
                onDeactivate={() => setDeactivateTarget(b)}
                onReactivate={async () => {
                  await reactivateBranch(b.id);
                  setMsg(`${b.name} is active again.`);
                  await load(true);
                  await refreshContext();
                }}
                onMakeDefault={async () => {
                  await makeBranchDefault(b.id);
                  setMsg(`${b.name} is now the default branch.`);
                  await load(true);
                  await refreshContext();
                }}
                onToggleOnline={() => setOnlineTarget(b)}
                onFocusBranch={() => setSelection(b.id)}
                deactivateDisabledReason={deactivateReason(b)}
              />
            ))}
          </ul>

          {isAdmin && <BranchesPerformance branches={branches} />}

          {inactiveBranches.length > 0 && isAdmin && (
            <div>
              <button
                type="button"
                className="flex items-center gap-2 text-sm font-semibold text-stone-700 dark:text-stone-200"
                onClick={() => setInactiveOpen((v) => !v)}
              >
                <ChevronDown size={16} className={inactiveOpen ? "rotate-180" : ""} />
                Inactive branches ({inactiveBranches.length})
              </button>
              {inactiveOpen && (
                <ul className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {inactiveBranches.map((b) => (
                    <BranchCard
                      key={b.id}
                      branch={b}
                      isAdmin
                      checklistDismissed
                      onDismissChecklist={() => {}}
                      onEdit={() => openEdit(b)}
                      onDeactivate={() => {}}
                      onReactivate={async () => {
                        await reactivateBranch(b.id);
                        await load(true);
                      }}
                      onMakeDefault={() => {}}
                      onToggleOnline={() => {}}
                      onFocusBranch={() => setSelection(b.id)}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {formOpen && (
        <BranchFormSheet
          open={formOpen}
          mode={editTarget ? "edit" : "create"}
          form={form}
          setForm={setForm}
          saving={saving}
          error={formError}
          codeLocked={Boolean(editTarget)}
          branchOptions={branches.filter((b) => b.isActive)}
          managerOptions={managerOptions}
          isAdmin={Boolean(isAdmin)}
          onClose={() => setFormOpen(false)}
          onSubmit={onSubmit}
        />
      )}

      <DeactivateBranchSheet
        branch={deactivateTarget}
        otherBranches={activeBranches.filter((b) => b.id !== deactivateTarget?.id)}
        open={Boolean(deactivateTarget)}
        saving={deactivating}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={async (opts) => {
          if (!deactivateTarget) return;
          setDeactivating(true);
          try {
            await deactivateBranch(deactivateTarget.id, opts);
            setMsg(`${deactivateTarget.name} deactivated.`);
            setDeactivateTarget(null);
            await load(true);
            await refreshContext();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not deactivate");
          } finally {
            setDeactivating(false);
          }
        }}
      />

      <ConfirmSheet
        open={Boolean(onlineTarget)}
        title={onlineTarget?.acceptsOnlineOrders ? "Turn off online ordering?" : "Turn online ordering on?"}
        message={
          onlineTarget?.acceptsOnlineOrders
            ? "Customers will not be able to check out for this branch until you turn it back on."
            : "Customers can place online orders for this branch again."
        }
        reasonRequired={Boolean(onlineTarget?.acceptsOnlineOrders)}
        reasonLabel="Reason"
        confirmLabel="Confirm"
        saving={onlineSaving}
        onClose={() => setOnlineTarget(null)}
        onConfirm={async (reason) => {
          if (!onlineTarget) return;
          setOnlineSaving(true);
          try {
            await toggleBranchOnlineOrdering(onlineTarget.id, !onlineTarget.acceptsOnlineOrders, reason || "Updated");
            setMsg("Online ordering updated.");
            setOnlineTarget(null);
            await load(true);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not update");
          } finally {
            setOnlineSaving(false);
          }
        }}
      />
    </AdminPage>
  );
}
