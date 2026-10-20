"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TicketPercent } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { pkr } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { usePoll } from "@/hooks/usePoll";
import { AdminPage, AdminPageHeader, AdminEmptyState } from "@/components/admin/ui";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { Pagination } from "@/components/Pagination";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { CatalogViewToggle, parseCatalogView } from "@/modules/catalog/CatalogViewToggle";
import { emptyVoucher, VoucherFormData, VoucherFormSheet } from "@/components/admin/VoucherFormSheet";
import { minutesToTimeLabel, timeToMinutes } from "./catalog-constants";

type CouponRow = {
  id: string;
  code: string;
  name?: string;
  description?: string;
  type: "PERCENT" | "FIXED";
  value: number | string;
  minSubtotal: number | string;
  maxSubtotal?: number | string | null;
  maxDiscount: number | string | null;
  usageLimit: number | null;
  perCustomerLimit?: number | null;
  firstOrderOnly?: boolean;
  usedCount: number;
  startsAt: string | null;
  endsAt: string | null;
  scheduleDays?: number[];
  scheduleStartMinutes?: number | null;
  scheduleEndMinutes?: number | null;
  channelOnline?: boolean;
  channelPos?: boolean;
  channelDineIn?: boolean;
  validDelivery?: boolean;
  validPickup?: boolean;
  validDineIn?: boolean;
  isActive: boolean;
};

function toDateInput(iso: string | null) {
  if (!iso) return "";
  return String(iso).slice(0, 10);
}

function voucherStatus(row: CouponRow, now = new Date()) {
  if (!row.isActive) return "inactive";
  if (row.startsAt && new Date(row.startsAt) > now) return "scheduled";
  if (row.endsAt && new Date(row.endsAt) < now) return "expired";
  if (row.usageLimit != null && row.usedCount >= row.usageLimit) return "exhausted";
  return "active";
}

const PAGE_SIZE = 10;

export function VouchersCatalogPage() {
  const { user } = useAuth();
  const canManage = user?.role === "ADMIN" || user?.role === "MANAGER";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";
  const status = searchParams.get("status") || "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const view = parseCatalogView(searchParams.get("view"));

  const [searchInput, setSearchInput] = useState(q);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VoucherFormData>(emptyVoucher);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(() => api<{ coupons: CouponRow[] }>("/admin/coupons"), []);
  const { data, loading, refreshing, refresh, error } = usePoll(load, 20_000);
  const coupons = data?.coupons ?? [];

  const setQuery = useCallback(
    (patch: Record<string, string | undefined>) => {
      const p = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") p.delete(k);
        else p.set(k, v);
      }
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (searchInput !== q) setQuery({ q: searchInput || undefined, page: "1" });
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput, q, setQuery]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return coupons.filter((row) => {
      const st = voucherStatus(row);
      if (status && st !== status) return false;
      if (needle && !row.code.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [coupons, q, status]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  const counts = useMemo(() => {
    const now = new Date();
    return {
      active: coupons.filter((c) => voucherStatus(c, now) === "active").length,
      scheduled: coupons.filter((c) => voucherStatus(c, now) === "scheduled").length,
      expired: coupons.filter((c) => voucherStatus(c, now) === "expired").length,
      inactive: coupons.filter((c) => voucherStatus(c, now) === "inactive").length,
    };
  }, [coupons]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyVoucher);
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(row: CouponRow) {
    setEditingId(row.id);
    setForm({
      ...emptyVoucher,
      code: row.code,
      name: row.name || "",
      description: row.description || "",
      type: row.type,
      value: String(row.value),
      minSubtotal: row.minSubtotal != null && Number(row.minSubtotal) > 0 ? String(row.minSubtotal) : "",
      maxSubtotal: row.maxSubtotal != null ? String(row.maxSubtotal) : "",
      maxDiscount: row.maxDiscount != null ? String(row.maxDiscount) : "",
      usageLimit: row.usageLimit != null ? String(row.usageLimit) : "",
      perCustomerLimit: row.perCustomerLimit != null ? String(row.perCustomerLimit) : "",
      firstOrderOnly: Boolean(row.firstOrderOnly),
      startsAt: toDateInput(row.startsAt),
      endsAt: toDateInput(row.endsAt),
      scheduleDays: row.scheduleDays ?? [],
      scheduleStartTime: minutesToTimeLabel(row.scheduleStartMinutes),
      scheduleEndTime: minutesToTimeLabel(row.scheduleEndMinutes),
      channelOnline: row.channelOnline !== false,
      channelPos: row.channelPos !== false,
      channelDineIn: row.channelDineIn !== false,
      validDelivery: row.validDelivery !== false,
      validPickup: row.validPickup !== false,
      validDineIn: row.validDineIn !== false,
      isActive: row.isActive,
    });
    setFormError("");
    setFormOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    const body = {
      code: form.code,
      name: form.name,
      description: form.description,
      type: form.type,
      value: Number(form.value),
      minSubtotal: Number(form.minSubtotal) || 0,
      maxSubtotal: form.maxSubtotal ? Number(form.maxSubtotal) : null,
      maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null,
      usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
      perCustomerLimit: form.perCustomerLimit ? Number(form.perCustomerLimit) : null,
      firstOrderOnly: form.firstOrderOnly,
      startsAt: form.startsAt || null,
      endsAt: form.endsAt || null,
      scheduleDays: form.scheduleDays,
      scheduleStartMinutes: timeToMinutes(form.scheduleStartTime) ?? null,
      scheduleEndMinutes: timeToMinutes(form.scheduleEndTime) ?? null,
      channelOnline: form.channelOnline,
      channelPos: form.channelPos,
      channelDineIn: form.channelDineIn,
      validDelivery: form.validDelivery,
      validPickup: form.validPickup,
      validDineIn: form.validDineIn,
      isActive: form.isActive,
    };
    try {
      await api(editingId ? `/admin/coupons/${editingId}` : "/admin/coupons", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      setFormOpen(false);
      await refresh();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not save voucher.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: CouponRow) {
    await api(`/admin/coupons/${row.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !row.isActive }),
    });
    await refresh();
  }

  return (
    <AdminPage fill>
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex shrink-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <AdminPageHeader title="Vouchers" description="Promo codes at checkout" icon={TicketPercent} />
          <div className="flex min-w-0 flex-wrap items-center gap-2 xl:justify-end">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search codes…"
              className="min-h-11 min-w-[12rem] flex-1 rounded-xl border border-stone-200 bg-white px-3 text-sm dark:border-stone-600 dark:bg-stone-900 xl:max-w-xs"
            />
            <AdminSelect
              value={status}
              onChange={(v) => setQuery({ status: v || undefined, page: "1" })}
              options={[
                { value: "", label: "All statuses" },
                { value: "active", label: `Active (${counts.active})` },
                { value: "scheduled", label: `Scheduled (${counts.scheduled})` },
                { value: "expired", label: `Expired (${counts.expired})` },
                { value: "inactive", label: `Inactive (${counts.inactive})` },
              ]}
              aria-label="Voucher status"
              minWidth="min-w-[11rem]"
              className="shrink-0"
            />
            <CatalogViewToggle value={view} onChange={(v) => setQuery({ view: v })} />
            <RefreshButton busy={loading || refreshing} onClick={() => void refresh()} showLabel={false} />
            {canManage && (
              <button type="button" onClick={openCreate} className="min-h-11 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white">
                Create voucher
              </button>
            )}
          </div>
        </div>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading && !data ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton h-44 rounded-2xl" />
              ))}
            </div>
          ) : pageRows.length === 0 ? (
            <AdminEmptyState
              icon={TicketPercent}
              title="No vouchers"
              description="Create a promo code customers can enter at checkout."
              action={
                canManage ? (
                  <button type="button" onClick={openCreate} className="btn-primary">
                    Create voucher
                  </button>
                ) : undefined
              }
            />
          ) : view === "list" ? (
            <div className="overflow-x-auto rounded-2xl border border-stone-200/80 bg-white dark:border-stone-700 dark:bg-stone-900">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-stone-100 text-xs uppercase text-stone-500 dark:border-stone-800">
                  <tr>
                    <th className="px-3 py-3">Code</th>
                    <th className="px-3 py-3">Discount</th>
                    <th className="hidden px-3 py-3 md:table-cell">Min order</th>
                    <th className="hidden px-3 py-3 lg:table-cell">Usage</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => (
                    <tr key={row.id} className="border-b border-stone-50 dark:border-stone-800">
                      <td className="px-3 py-3 font-mono font-bold tracking-wide">{row.code}</td>
                      <td className="px-3 py-3 font-semibold text-brand-700">
                        {row.type === "PERCENT" ? `${row.value}% off` : `${pkr(row.value)} off`}
                      </td>
                      <td className="hidden px-3 py-3 md:table-cell">{pkr(row.minSubtotal)}</td>
                      <td className="hidden px-3 py-3 lg:table-cell">
                        {row.usedCount}
                        {row.usageLimit != null ? ` / ${row.usageLimit}` : ""}
                      </td>
                      <td className="px-3 py-3 capitalize text-stone-600">{voucherStatus(row)}</td>
                      <td className="px-3 py-3 text-right">
                        {canManage && (
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => openEdit(row)} className="min-h-11 rounded-xl bg-stone-100 px-3 text-xs font-semibold dark:bg-stone-800">
                              Edit
                            </button>
                            <button type="button" onClick={() => void toggleActive(row)} className="min-h-11 rounded-xl px-3 text-xs font-semibold">
                              {row.isActive ? "Deactivate" : "Activate"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className="grid grid-cols-1 content-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {pageRows.map((row) => {
                const st = voucherStatus(row);
                return (
                  <li
                    key={row.id}
                    className="flex flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-900"
                  >
                    <div className="flex items-start justify-between gap-3 bg-gradient-to-br from-brand-600 to-orange-600 px-4 py-4 text-white">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80">Voucher</p>
                        <p className="mt-1 font-mono text-2xl font-bold tracking-wide">{row.code}</p>
                      </div>
                      <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold capitalize">
                        {st}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <p className="text-lg font-bold text-stone-900 dark:text-stone-50">
                        {row.type === "PERCENT" ? `${row.value}% off` : `${pkr(row.value)} off`}
                      </p>
                      <p className="text-sm text-stone-500">
                        {Number(row.minSubtotal) > 0
                          ? `Valid on orders of ${pkr(row.minSubtotal)} or more`
                          : "No minimum order"}
                        {row.maxDiscount != null && row.type === "PERCENT" ? ` · cap ${pkr(row.maxDiscount)}` : ""}
                      </p>
                      <p className="text-xs text-stone-500">
                        Used {row.usedCount}
                        {row.usageLimit != null ? ` of ${row.usageLimit}` : " · no usage cap"}
                      </p>
                      {(row.startsAt || row.endsAt) && (
                        <p className="text-xs text-stone-500">
                          {row.startsAt ? toDateInput(row.startsAt) : "Anytime"} → {row.endsAt ? toDateInput(row.endsAt) : "No end"}
                        </p>
                      )}
                      {canManage && (
                        <div className="mt-auto flex gap-2 border-t border-stone-100 pt-3 dark:border-stone-800">
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="min-h-11 flex-1 rounded-xl bg-stone-100 text-xs font-semibold dark:bg-stone-800"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleActive(row)}
                            className="min-h-11 rounded-xl px-3 text-xs font-semibold text-stone-600"
                          >
                            {row.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {total > 0 ? (
          <div className="mt-auto shrink-0 border-t border-stone-200/80 bg-[#fffaf5] dark:border-stone-700 dark:bg-stone-950">
            <Pagination
              docked
              page={safePage}
              totalPages={totalPages}
              totalItems={total}
              rangeStart={start + 1}
              rangeEnd={Math.min(start + PAGE_SIZE, total)}
              onPageChange={(p) => setQuery({ page: String(p) })}
            />
          </div>
        ) : null}
      </div>

      {formOpen && (
        <VoucherFormSheet
          open={formOpen}
          editingId={editingId}
          form={form}
          setForm={setForm}
          saving={saving}
          error={formError}
          onClose={() => setFormOpen(false)}
          onSubmit={onSubmit}
        />
      )}
    </AdminPage>
  );
}
