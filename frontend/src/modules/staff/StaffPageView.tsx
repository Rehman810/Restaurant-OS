"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, UserCog } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fetchStaffPage, STAFF_PAGE_SIZE } from "@/lib/admin-staff";
import { Pagination } from "@/components/Pagination";
import { AdminScopeBanner } from "@/components/admin/AdminScopeBanner";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { StaffKpiStrip } from "@/components/admin/StaffKpiStrip";
import { ConfirmSheet } from "@/components/admin/ConfirmSheet";
import { StaffTable } from "@/components/admin/StaffTable";
import { StaffFormData, StaffFormSheet } from "@/components/admin/StaffFormSheet";
import { StaffDetailDrawer } from "@/components/admin/StaffDetailDrawer";
import { StaffRoleChangeSheet } from "@/components/admin/StaffRoleChangeSheet";
import {
  StaffFiltersSheet,
  StaffFiltersSheetTrigger,
  StaffMobileFilterFields,
} from "@/components/admin/StaffFiltersSheet";
import type { StaffAction } from "@/components/admin/StaffActionsMenu";
import { OrdersActiveFilters } from "@/components/admin/orders/OrdersActiveFilters";
import { usePoll } from "@/hooks/usePoll";
import {
  AdminAlert,
  AdminEmptyState,
  AdminFilterBar,
  AdminPage,
  AdminPageHeader,
  SearchField,
  SelectField,
} from "@/components/admin/ui";
import type { StaffListRow, StaffTileFilter } from "./types";
import { parseStaffSearchParams, staffParamsToSearchParams } from "./url-state";
import { creatableRoles, canManageStaff } from "./helpers";
import { Role } from "@/lib/types";

function defaultBranchIds(selection: string, branches: { id: string; isDefault?: boolean }[]) {
  if (selection !== "all") return [selection];
  const pick = branches.find((b) => b.isDefault) ?? branches[0];
  return pick ? [pick.id] : [];
}

const emptyForm: StaffFormData = {
  name: "",
  email: "",
  phone: "",
  password: "",
  role: "CHEF",
  autoGeneratePassword: true,
  sendInvite: true,
  branchIds: [],
};

export function StaffPageView({
  branchOptions,
  branchSelection,
}: {
  branchOptions: { id: string; name: string; address?: string }[];
  branchSelection: string;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseStaffSearchParams(searchParams), [searchParams]);

  const [searchInput, setSearchInput] = useState(filters.q ?? "");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"ok" | "err">("ok");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<StaffListRow | null>(null);
  const [form, setForm] = useState<StaffFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<StaffListRow | null>(null);
  const [detail, setDetail] = useState<StaffListRow | null>(null);
  const [roleChangeMember, setRoleChangeMember] = useState<StaffListRow | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const setQuery = useCallback(
    (patch: Record<string, string | null>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") sp.delete(k);
        else sp.set(k, v);
      }
      router.replace(`?${sp.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchInput !== (filters.q ?? "")) setQuery({ q: searchInput || null, page: null });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, filters.q, setQuery]);

  const load = useCallback(async () => {
    const res = await fetchStaffPage({
      q: filters.q,
      role: filters.role,
      branchId: filters.branchId,
      status: filters.status,
      twoFa: filters.twoFa,
      lastActive: filters.lastActive,
      includeTest: filters.includeTest,
      sort: filters.sort,
      order: filters.order,
      page: filters.page,
    });
    setLastUpdated(new Date());
    return res;
  }, [filters]);

  const { data, loading, refreshing, error, refresh } = usePoll(load, 30000);
  const showSkeleton = loading && !data;

  const counts = data?.counts;
  const staff = data?.staff ?? [];
  const total = data?.total ?? 0;
  const page = filters.page ?? 1;
  const totalPages = Math.max(1, Math.ceil(total / STAFF_PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * STAFF_PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * STAFF_PAGE_SIZE, total);

  const roleLabels: Record<Role, string> = {
    ADMIN: "Admin",
    MANAGER: "Manager",
    WAITER: "Waiter",
    CHEF: "Chef",
    RIDER: "Rider",
    CASHIER: "Cashier",
    CUSTOMER: "Customer",
  };

  const roleOptions = useMemo(() => {
    const roles = creatableRoles(user);
    return roles.map((r) => ({ value: r, label: roleLabels[r] }));
  }, [user]);

  const roleChangeOptions = useMemo(() => {
    if (!roleChangeMember) return roleOptions;
    const set = new Set<Role>(creatableRoles(user));
    set.add(roleChangeMember.role);
    return [...set].map((r) => ({ value: r, label: roleLabels[r] }));
  }, [user, roleChangeMember, roleOptions]);

  function openCreate() {
    setFormMode("create");
    setEditing(null);
    setForm({ ...emptyForm, branchIds: defaultBranchIds(branchSelection, branchOptions) });
    setFormOpen(true);
  }

  function openEdit(member: StaffListRow) {
    setFormMode("edit");
    setEditing(member);
    setForm({
      name: member.name,
      email: member.email,
      phone: member.phone ?? "",
      password: "",
      role: member.role,
      autoGeneratePassword: true,
      sendInvite: true,
      branchIds: member.branchIds ?? [],
    });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm);
  }

  async function submitForm(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      if (formMode === "edit" && editing) {
        await api(`/admin/staff/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: form.name,
            phone: form.phone || null,
            branchIds: form.branchIds,
          }),
        });
        setMsgTone("ok");
        setMsg("Staff updated.");
      } else {
        const res = await api<{ emailed?: boolean; temporaryPassword?: string }>("/admin/staff", {
          method: "POST",
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            phone: form.phone,
            role: form.role,
            sendInvite: form.sendInvite,
            autoGeneratePassword: !form.sendInvite,
            password: form.sendInvite ? undefined : form.password.trim() || undefined,
            branchIds: form.branchIds,
          }),
        });
        setMsgTone("ok");
        setMsg(
          res.temporaryPassword
            ? `Account created. Temporary password (shown once): ${res.temporaryPassword}`
            : res.emailed
              ? "Invite email sent."
              : "Staff account created."
        );
      }
      closeForm();
      refresh();
    } catch (err) {
      setMsgTone("err");
      setMsg(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    try {
      await api(`/admin/staff/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      refresh();
      setMsgTone("ok");
      setMsg("Updated.");
    } catch (err) {
      setMsgTone("err");
      setMsg(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function runAction(member: StaffListRow, action: StaffAction) {
    if (action === "edit") {
      openEdit(member);
      return;
    }
    if (action === "deactivate") {
      setDeactivateTarget(member);
      return;
    }
    if (action === "reactivate") {
      await patch(member.id, { isActive: true });
      return;
    }
    if (action === "role") {
      setRoleChangeMember(member);
      return;
    }
    if (action === "branches") {
      openEdit(member);
      return;
    }
    if (action === "resetPassword") {
      setBusyId(member.id);
      try {
        await api(`/admin/staff/${member.id}/reset-password`, { method: "POST" });
        setMsgTone("ok");
        setMsg("Password reset email sent.");
      } catch (err) {
        setMsgTone("err");
        setMsg(err instanceof Error ? err.message : "Reset failed.");
      } finally {
        setBusyId(null);
      }
      return;
    }
    if (action === "reset2fa") {
      setBusyId(member.id);
      try {
        await api(`/admin/staff/${member.id}/reset-2fa`, { method: "POST" });
        refresh();
        setMsgTone("ok");
        setMsg("Two-factor authentication reset.");
      } catch (err) {
        setMsgTone("err");
        setMsg(err instanceof Error ? err.message : "Reset failed.");
      } finally {
        setBusyId(null);
      }
      return;
    }
    if (action === "sessions") {
      setDetail(member);
      return;
    }
    if (action === "pin") {
      setMsgTone("ok");
      setMsg("Use Settings → My account or the staff profile to set an approval PIN.");
    }
  }

  function setTile(tile: StaffTileFilter) {
    const sp = staffParamsToSearchParams({ ...filters, tile, page: 1 });
    router.replace(`?${sp.toString()}`, { scroll: false });
  }

  const filterChips = useMemo(() => {
    const chips: { key: string; label: string }[] = [];
    const q = searchParams.get("q");
    const tile = searchParams.get("tile");
    const tileLabels: Record<string, string> = {
      admins: "Admins",
      managers: "Managers",
      cashiers: "Cashiers",
      chefs: "Chefs",
      riders: "Riders",
      inactive: "Inactive",
      twoFaOff: "2FA off",
    };

    if (q) chips.push({ key: "q", label: `Search: ${q}` });

    if (tile) {
      chips.push({ key: "tile", label: tileLabels[tile] ?? tile });
    } else {
      searchParams.getAll("role").forEach((r) => {
        chips.push({ key: `role:${r}`, label: `Role: ${r}` });
      });
      searchParams.getAll("status").forEach((s) => {
        chips.push({ key: `status:${s}`, label: s === "active" ? "Active" : "Inactive" });
      });
      const twoFa = searchParams.get("twoFa");
      if (twoFa === "on" || twoFa === "off") {
        chips.push({ key: "twoFa", label: `2FA: ${twoFa === "on" ? "On" : "Off"}` });
      }
    }

    const branchId = searchParams.get("branchId");
    if (branchId) {
      const name = branchOptions.find((b) => b.id === branchId)?.name ?? "Branch";
      chips.push({ key: "branchId", label: name });
    }

    const lastActive = searchParams.get("lastActive");
    if (lastActive) {
      const lastLabels: Record<string, string> = {
        "7": "Last 7 days",
        "30": "Last 30 days",
        "90": "Last 90 days",
        never: "Never logged in",
      };
      chips.push({ key: "lastActive", label: lastLabels[lastActive] ?? lastActive });
    }

    return chips;
  }, [searchParams, branchOptions]);

  if (!canManageStaff(user)) {
    return (
      <AdminPage>
        <AdminEmptyState icon={UserCog} title="You do not have access to staff management." />
      </AdminPage>
    );
  }

  function setRoleFilter(v: string) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("role");
    if (v) sp.append("role", v);
    sp.delete("tile");
    sp.delete("page");
    router.replace(`?${sp.toString()}`, { scroll: false });
  }

  return (
    <AdminPage>
      <AdminScopeBanner variant="staff" managerScope={user?.role === "MANAGER"} />
      <AdminPageHeader
        title="Staff"
        description="Roles, access, and security for your team"
        icon={UserCog}
        iconAccent="violet"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <RefreshButton busy={loading || refreshing} updatedAt={lastUpdated} onClick={refresh} />
            {user?.role === "ADMIN" || user?.role === "MANAGER" ? (
              <button type="button" onClick={openCreate} className="btn-primary min-h-[44px]">
                <Plus size={16} /> Add staff
              </button>
            ) : null}
          </div>
        }
      />

      <StaffKpiStrip counts={counts} activeTile={filters.tile ?? null} onTile={setTile} />

      <div aria-live="polite" className="sr-only">{msg}</div>
      {error && <AdminAlert variant="error">{error}</AdminAlert>}
      {msg && <AdminAlert variant={msgTone === "ok" ? "success" : "error"}>{msg}</AdminAlert>}

      <div className="flex flex-col gap-2 md:hidden">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <SearchField
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Search staff…"
            />
          </div>
          <StaffFiltersSheetTrigger
            activeCount={filterChips.length}
            onClick={() => setFiltersOpen(true)}
          />
        </div>
      </div>

      <StaffFiltersSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        searchInput={searchInput}
        onSearchInput={setSearchInput}
      >
        <StaffMobileFilterFields
          user={user}
          filters={filters}
          branchOptions={branchOptions}
          onRole={(v) => {
            const sp = new URLSearchParams(searchParams.toString());
            sp.delete("role");
            if (v) sp.append("role", v);
            sp.delete("tile");
            sp.delete("page");
            router.replace(`?${sp.toString()}`, { scroll: false });
          }}
          onBranch={(v) => setQuery({ branchId: v || null, page: null })}
          onStatus={(v) => {
            const sp = new URLSearchParams(searchParams.toString());
            sp.delete("status");
            if (v) sp.append("status", v);
            sp.delete("tile");
            sp.delete("page");
            router.replace(`?${sp.toString()}`, { scroll: false });
          }}
          onTwoFa={(v) => setQuery({ twoFa: v || null, tile: null, page: null })}
          onLastActive={(v) => setQuery({ lastActive: v || null, page: null })}
        />
      </StaffFiltersSheet>

      <AdminFilterBar className="hidden md:grid lg:grid-cols-[minmax(0,20rem)_1fr] lg:items-end lg:gap-4">
        <div className="min-w-0 space-y-1">
          <span className="text-xs font-semibold text-stone-600 dark:text-stone-400">Search</span>
          <SearchField
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Name, email, phone…"
          />
        </div>
        <div className="flex min-w-0 flex-wrap items-end justify-start gap-3 lg:justify-end">
          <SelectField
            className="w-full min-w-[8.75rem] sm:w-[9.25rem]"
            label="Role"
            value={filters.tile ? "" : (filters.role?.[0] ?? "")}
            onChange={setRoleFilter}
            options={[
              { value: "", label: "All roles" },
              { value: "ADMIN", label: "Admin" },
              { value: "MANAGER", label: "Manager" },
              { value: "CASHIER", label: "Cashier" },
              { value: "CHEF", label: "Chef" },
              { value: "RIDER", label: "Rider" },
              { value: "WAITER", label: "Waiter" },
            ]}
          />
          {user?.role === "ADMIN" && (
            <SelectField
              className="w-full min-w-[8.75rem] sm:w-[9.25rem]"
              label="Branch"
              value={filters.branchId ?? ""}
              onChange={(v) => setQuery({ branchId: v || null, page: null })}
              options={[
                { value: "", label: "All branches" },
                ...branchOptions.map((b) => ({ value: b.id, label: b.name })),
              ]}
            />
          )}
          <SelectField
            className="w-full min-w-[8.75rem] sm:w-[9.25rem]"
            label="Status"
            value={filters.status?.[0] ?? ""}
            onChange={(v) => {
              const sp = new URLSearchParams(searchParams.toString());
              sp.delete("status");
              if (v) sp.append("status", v);
              sp.delete("tile");
              sp.delete("page");
              router.replace(`?${sp.toString()}`, { scroll: false });
            }}
            options={[
              { value: "", label: "Any status" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
          <SelectField
            className="w-full min-w-[8.75rem] sm:w-[9.25rem]"
            label="2FA"
            value={filters.twoFa ?? ""}
            onChange={(v) => setQuery({ twoFa: v || null, tile: null, page: null })}
            options={[
              { value: "", label: "Any" },
              { value: "on", label: "On" },
              { value: "off", label: "Off" },
            ]}
          />
          <SelectField
            className="w-full min-w-[8.75rem] sm:w-[9.25rem]"
            label="Last active"
            value={filters.lastActive ?? ""}
            onChange={(v) => setQuery({ lastActive: v || null, page: null })}
            options={[
              { value: "", label: "Any time" },
              { value: "7", label: "Last 7 days" },
              { value: "30", label: "Last 30 days" },
              { value: "90", label: "Last 90 days" },
              { value: "never", label: "Never logged in" },
            ]}
          />
        </div>
      </AdminFilterBar>

      <OrdersActiveFilters
        tone="neutral"
        chips={filterChips}
        onRemove={(key) => {
          if (key === "q") {
            setSearchInput("");
            setQuery({ q: null });
          } else if (key.startsWith("role:")) setQuery({ role: null, tile: null });
          else if (key === "branchId") setQuery({ branchId: null });
          else if (key.startsWith("status:")) setQuery({ status: null, tile: null });
          else if (key === "twoFa") setQuery({ twoFa: null, tile: null });
          else if (key === "lastActive") setQuery({ lastActive: null });
          else if (key === "tile") setQuery({ tile: null });
        }}
        onClearAll={() => {
          setSearchInput("");
          router.replace("?", { scroll: false });
        }}
      />

      {user?.role === "ADMIN" && selected.size > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary min-h-[44px]"
            onClick={async () => {
              for (const id of selected) {
                await patch(id, { isActive: false }).catch(() => null);
              }
              setSelected(new Set());
            }}
          >
            Deactivate selected ({selected.size})
          </button>
        </div>
      )}

      {showSkeleton ? (
        <div className="skeleton h-80 rounded-2xl" />
      ) : total === 0 ? (
        <AdminEmptyState
          icon={UserCog}
          title={filters.q ? "No staff match your filters" : "No staff yet"}
          action={
            !filters.q ? (
              <button type="button" onClick={openCreate} className="btn-primary min-h-[44px]">
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
            currentUser={user}
            busyId={busyId}
            dimmed={refreshing}
            selectedIds={selected}
            onSelectToggle={(id) => {
              setSelected((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              });
            }}
            onRowClick={setDetail}
            onAction={runAction}
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={total}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onPageChange={(p) => setQuery({ page: p > 1 ? String(p) : null })}
          />
        </>
      )}

      {formOpen && (
        <StaffFormSheet
          open={formOpen}
          mode={formMode}
          form={form}
          setForm={setForm}
          branches={branchOptions}
          roleOptions={roleOptions}
          saving={saving}
          error={msgTone === "err" ? msg : ""}
          onClose={closeForm}
          onSubmit={submitForm}
        />
      )}

      <StaffDetailDrawer member={detail} open={Boolean(detail)} onClose={() => setDetail(null)} />

      <ConfirmSheet
        open={Boolean(deactivateTarget)}
        title={`Deactivate ${deactivateTarget ? deactivateTarget.name : "staff"}?`}
        message="Their sessions will end. Order and shift history is kept."
        confirmLabel="Deactivate"
        danger
        saving={busyId === deactivateTarget?.id}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => {
          if (!deactivateTarget) return;
          patch(deactivateTarget.id, { isActive: false }).finally(() => setDeactivateTarget(null));
        }}
      />

      <StaffRoleChangeSheet
        open={Boolean(roleChangeMember)}
        memberName={roleChangeMember?.name ?? ""}
        currentRole={roleChangeMember?.role ?? "CHEF"}
        options={roleChangeOptions}
        saving={busyId === roleChangeMember?.id}
        onClose={() => setRoleChangeMember(null)}
        onConfirm={(role) => {
          if (!roleChangeMember) return;
          patch(roleChangeMember.id, { role }).finally(() => setRoleChangeMember(null));
        }}
      />
    </AdminPage>
  );
}
