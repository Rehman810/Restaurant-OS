"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Bike,
  ChefHat,
  Plus,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fetchStaffPage } from "@/lib/admin-staff";
import { PAGE_SIZE } from "@/lib/pagination";
import { Pagination } from "@/components/Pagination";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { ConfirmSheet } from "@/components/admin/ConfirmSheet";
import { StaffRow, StaffTable } from "@/components/admin/StaffTable";
import { StaffFormData, StaffFormSheet } from "@/components/admin/StaffFormSheet";
import { usePoll } from "@/hooks/usePoll";
import { AdminScopeBanner } from "@/components/admin/AdminScopeBanner";
import {
  AdminAlert,
  AdminEmptyState,
  AdminFilterBar,
  AdminKpiCard,
  AdminKpiGrid,
  AdminPage,
  AdminPageHeader,
  SearchField,
} from "@/components/admin/ui";
import { useBranch } from "@/modules/branches/BranchContext";

function defaultBranchIds(selection: string, branches: { id: string; isDefault?: boolean }[]) {
  if (selection !== "all") return [selection];
  const pick = branches.find((b) => b.isDefault) ?? branches[0];
  return pick ? [pick.id] : [];
}

export default function StaffPage() {
  const { user } = useAuth();
  const { selection, branches } = useBranch();
  const branchOptions = branches.map((b) => ({ id: b.id, name: b.name, address: b.address }));
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"ok" | "err">("ok");
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<StaffRow | null>(null);
  const emptyForm: StaffFormData = {
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "CHEF",
    autoGeneratePassword: true,
    branchIds: [],
  };
  const [form, setForm] = useState<StaffFormData>(emptyForm);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const load = useCallback(
    () =>
      fetchStaffPage({
        limit: PAGE_SIZE.table,
        offset: (page - 1) * PAGE_SIZE.table,
        search,
      }),
    [page, search]
  );

  const { data, loading, refreshing, error, refresh } = usePoll(load, 30000);
  const showSkeleton = loading && !data;

  function closeForm() {
    setFormOpen(false);
    setForm(emptyForm);
  }

  async function createStaff(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    setSaving(true);
    try {
      const res = await api<{ emailed?: boolean }>("/admin/staff", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          role: form.role,
          autoGeneratePassword: form.autoGeneratePassword,
          password: form.autoGeneratePassword ? undefined : form.password.trim() || undefined,
          branchIds: form.branchIds,
        }),
      });
      closeForm();
      refresh();
      setMsgTone("ok");
      setMsg(
        res.emailed
          ? "Staff account created. Login details were emailed."
          : "Staff account created. They can sign in at /login."
      );
    } catch (err) {
      setMsgTone("err");
      setMsg(err instanceof Error ? err.message : "Could not create staff.");
    } finally {
      setSaving(false);
    }
  }

  async function patch(id: string, data: Partial<StaffRow> & { branchIds?: string[] }) {
    setBusyId(id);
    setMsg("");
    try {
      await api(`/admin/staff/${id}`, { method: "PATCH", body: JSON.stringify(data) });
      refresh();
      setMsgTone("ok");
      setMsg("Staff updated.");
    } catch (err) {
      setMsgTone("err");
      setMsg(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusyId(null);
    }
  }

  function toggleActive(member: StaffRow) {
    if (member.isActive) {
      setDeactivateTarget(member);
      return;
    }
    patch(member.id, { isActive: true });
  }

  const staff = data?.staff ?? [];
  const total = data?.total ?? 0;
  const stats = data?.stats ?? { total: 0, chefs: 0, riders: 0, active: 0 };
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE.table));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE.table + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE.table, total);

  return (
    <AdminPage>
      <AdminScopeBanner variant="branch" />
      <AdminPageHeader
        title="Staff"
        description="Create chefs, riders, and cashiers. Assign branches in the table or when adding staff."
        icon={UserCog}
        actions={
          <>
            <RefreshButton busy={loading || refreshing} onClick={refresh} />
            <button
              type="button"
              onClick={() => {
                setForm({ ...emptyForm, branchIds: defaultBranchIds(selection, branches) });
                setFormOpen(true);
              }}
              className="btn-primary"
            >
              <Plus size={16} /> Add staff
            </button>
          </>
        }
      />

      <AdminKpiGrid>
        <AdminKpiCard label="Total staff" value={stats.total} icon={Users} accent="brand" />
        <AdminKpiCard label="Chefs" value={stats.chefs} icon={ChefHat} accent="orange" />
        <AdminKpiCard label="Riders" value={stats.riders} icon={Bike} accent="sky" />
        <AdminKpiCard label="Active" value={stats.active} icon={ShieldCheck} accent="emerald" />
      </AdminKpiGrid>

      {error && <AdminAlert variant="error">{error}</AdminAlert>}
      {msg && !(formOpen && msgTone === "err") && (
        <AdminAlert variant={msgTone === "ok" ? "success" : "error"}>{msg}</AdminAlert>
      )}

      <AdminFilterBar>
        <SearchField
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search staff by name, email or phone…"
        />
      </AdminFilterBar>

      {showSkeleton ? (
        <div className="skeleton h-80 rounded-2xl" />
      ) : total === 0 ? (
        <AdminEmptyState
          icon={Users}
          title={search ? "No staff match your search" : "No staff yet"}
          action={
            !search ? (
              <button type="button" onClick={() => setFormOpen(true)} className="btn-primary">
                Add first staff member
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          <StaffTable
            staff={staff}
            branches={branchOptions}
            currentUserId={user?.id}
            busyId={busyId}
            onToggleActive={toggleActive}
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={total}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onPageChange={setPage}
          />
        </>
      )}

      {formOpen && (
        <StaffFormSheet
          open={formOpen}
          form={form}
          setForm={setForm}
          branches={branchOptions}
          saving={saving}
          error={msgTone === "err" ? msg : ""}
          onClose={closeForm}
          onSubmit={createStaff}
        />
      )}

      <ConfirmSheet
        open={Boolean(deactivateTarget)}
        title={`Deactivate ${deactivateTarget?.name ?? "staff"}?`}
        message="Their active sessions will end and they will not be able to sign in until reactivated."
        confirmLabel="Deactivate"
        danger
        saving={busyId === deactivateTarget?.id}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => {
          if (!deactivateTarget) return;
          patch(deactivateTarget.id, { isActive: false }).finally(() => setDeactivateTarget(null));
        }}
      />
    </AdminPage>
  );
}
