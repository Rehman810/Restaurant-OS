"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, ScrollText, SlidersHorizontal, X } from "lucide-react";
import { api, downloadAuditLogCsv } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { Pagination } from "@/components/Pagination";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
  AdminEmptyState,
  AdminFilterBar,
  AdminPage,
  AdminPageHeader,
  SearchField,
  Segment,
} from "@/components/admin/ui";
import { AdminScopeBanner } from "@/components/admin/AdminScopeBanner";
import { AuditLogDetailDrawer } from "@/components/admin/audit-log/AuditLogDetailDrawer";
import {
  actorKindLabel,
  AuditFilterOptions,
  AuditLogRow,
  DatePreset,
  formatAuditWhen,
  formatAuditWhenFull,
  rangeForPreset,
} from "@/lib/audit-log";

const PAGE_SIZES = [25, 50, 100] as const;

const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7d", label: "7 days" },
  { id: "custom", label: "Custom" },
];

function tzLabel(timezone: string) {
  if (timezone === "Asia/Karachi") return "PKT";
  return timezone;
}

export default function AuditLogPage() {
  const { user } = useAuth();
  const store = useStore();
  const allowed = user?.role === "ADMIN" || user?.role === "MANAGER";
  const isAdmin = user?.role === "ADMIN";
  const timezone = store?.settings.timezone ?? "Asia/Karachi";
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<AuditLogRow | null>(null);
  const [filterOpts, setFilterOpts] = useState<AuditFilterOptions | null>(null);
  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = PAGE_SIZES.includes(Number(searchParams.get("limit")) as 25 | 50 | 100)
    ? Number(searchParams.get("limit"))
    : 25;
  const category = searchParams.get("category") ?? "";
  const action = searchParams.get("action") ?? "";
  const entityType = searchParams.get("entityType") ?? "";
  const actorId = searchParams.get("actorId") ?? "";
  const search = searchParams.get("search") ?? "";
  const preset = (searchParams.get("preset") as DatePreset) || "7d";
  const customFrom = searchParams.get("from") ?? "";
  const customTo = searchParams.get("to") ?? "";
  const sensitiveOnly = searchParams.get("sensitiveOnly") === "1";

  const activeFilterCount = [category, action, entityType, actorId, search, sensitiveOnly ? "1" : ""].filter(
    Boolean
  ).length;

  const setParams = useCallback(
    (patch: Record<string, string | number | null | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === undefined || v === "") next.delete(k);
        else next.set(k, String(v));
      }
      router.replace(`/admin/audit-log?${next.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchInput !== search) setParams({ search: searchInput, page: 1 });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, search, setParams]);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  const queryString = useMemo(() => {
    const range = rangeForPreset(preset, timezone, customFrom, customTo);
    const params = new URLSearchParams({
      limit: String(pageSize),
      offset: String((page - 1) * pageSize),
    });
    if (category) params.set("category", category);
    if (action) params.set("action", action);
    if (entityType) params.set("entityType", entityType);
    if (actorId) params.set("actorId", actorId);
    if (search.trim()) params.set("search", search.trim());
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);
    if (sensitiveOnly) params.set("sensitiveOnly", "1");
    return params.toString();
  }, [
    page,
    pageSize,
    category,
    action,
    entityType,
    actorId,
    search,
    preset,
    customFrom,
    customTo,
    sensitiveOnly,
    timezone,
  ]);

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError("");
    try {
      const data = await api<{ logs: AuditLogRow[]; total: number; timezone: string }>(
        `/admin/audit-logs?${queryString}`
      );
      setRows(data.logs);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load audit log.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [allowed, queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!allowed) return;
    void api<AuditFilterOptions>("/admin/audit-logs/filters").then(setFilterOpts).catch(() => null);
  }, [allowed]);

  useEffect(() => {
    if (activeFilterCount > 0) setFiltersOpen(true);
  }, [activeFilterCount]);

  async function exportCsv() {
    try {
      await downloadAuditLogCsv(queryString);
    } catch {
      setError("Could not export CSV.");
    }
  }

  function clearFilters() {
    setSearchInput("");
    setParams({
      category: null,
      action: null,
      entityType: null,
      actorId: null,
      search: null,
      sensitiveOnly: null,
      page: 1,
    });
  }

  const actionOptions = useMemo(() => {
    if (!filterOpts) return [];
    if (category && filterOpts.actionsByCategory[category]) {
      return filterOpts.actionsByCategory[category];
    }
    return Object.values(filterOpts.actionsByCategory).flat();
  }, [filterOpts, category]);

  if (!allowed) {
    return (
      <AdminPage>
        <p className="text-sm text-stone-500">You do not have access to the audit log.</p>
      </AdminPage>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <AdminPage>
      <AdminScopeBanner variant="branch" />

      <AdminPageHeader
        icon={ScrollText}
        title="Audit log"
        description="Sensitive actions across orders, menu, cash, and staff."
        actions={
          <button type="button" className="btn-ghost" onClick={exportCsv}>
            <Download size={16} /> Export CSV
          </button>
        }
      />

      <AdminFilterBar className="!flex !flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchField
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search label or ID…"
            className="min-w-0 flex-1"
          />
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Segment
              value={preset}
              onChange={(v) => setParams({ preset: v, page: 1 })}
              options={DATE_PRESETS}
            />
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold transition ${
                sensitiveOnly
                  ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
                  : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-300"
              }`}
              onClick={() => setParams({ sensitiveOnly: sensitiveOnly ? null : "1", page: 1 })}
            >
              Sensitive
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-200"
              onClick={() => setFiltersOpen((o) => !o)}
              aria-expanded={filtersOpen}
            >
              <SlidersHorizontal size={15} />
              Filters
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {preset === "custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400">
              <span className="shrink-0 font-medium">From</span>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setParams({ from: e.target.value, page: 1 })}
                className="input admin-select !py-2"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400">
              <span className="shrink-0 font-medium">To</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setParams({ to: e.target.value, page: 1 })}
                className="input admin-select !py-2"
              />
            </label>
          </div>
        )}

        {filtersOpen && (
          <div className="flex flex-wrap items-end gap-2 border-t border-stone-200/80 pt-3 dark:border-stone-700">
            <AdminSelect
              aria-label="Category"
              value={category}
              onChange={(v) => setParams({ category: v, action: null, page: 1 })}
              placeholder="Category"
              options={[
                { value: "", label: "All categories" },
                ...(filterOpts?.categories.map((c) => ({ value: c, label: c })) ?? []),
              ]}
              className="w-[11rem]"
              minWidth="min-w-[11rem]"
            />
            <AdminSelect
              aria-label="Action"
              value={action}
              onChange={(v) => setParams({ action: v, page: 1 })}
              placeholder="Action"
              options={[
                { value: "", label: "All actions" },
                ...actionOptions.map((a) => ({ value: a.code, label: a.label })),
              ]}
              className="w-[13rem]"
              minWidth="min-w-[13rem]"
            />
            <AdminSelect
              aria-label="Entity type"
              value={entityType}
              onChange={(v) => setParams({ entityType: v, page: 1 })}
              placeholder="Entity"
              options={[
                { value: "", label: "All entities" },
                ...(filterOpts?.entityTypes.map((t) => ({ value: t, label: t })) ?? []),
              ]}
              className="w-[10rem]"
              minWidth="min-w-[10rem]"
            />
            <AdminSelect
              aria-label="Actor"
              value={actorId}
              onChange={(v) => setParams({ actorId: v, page: 1 })}
              placeholder="Actor"
              options={[
                { value: "", label: "All actors" },
                ...(filterOpts?.actors.map((a) => ({ value: a.id, label: a.name })) ?? []),
              ]}
              className="w-[11rem]"
              minWidth="min-w-[11rem]"
            />
            {activeFilterCount > 0 && (
              <button
                type="button"
                className="inline-flex items-center gap-1 px-2 py-2 text-sm font-semibold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                onClick={clearFilters}
              >
                <X size={14} /> Clear
              </button>
            )}
          </div>
        )}
      </AdminFilterBar>

      <p className="text-xs text-stone-500">
        {loading ? "Loading…" : `${total.toLocaleString()} entries`}
        {!loading && total > 0 && ` · Times in ${tzLabel(timezone)}`}
      </p>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {loading && <div className="skeleton h-64 rounded-2xl" />}

      {!loading && rows.length === 0 && !error && (
        <AdminEmptyState
          icon={ScrollText}
          title="No audit entries"
          description="Try widening the date range or clearing filters."
        />
      )}

      {!loading && rows.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-stone-100 bg-stone-50 text-xs uppercase tracking-wide text-stone-500 dark:border-stone-700 dark:bg-stone-800/80">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">What happened</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="hidden px-4 py-3 xl:table-cell">Branch</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const kind = actorKindLabel(r.actor.kind);
                  return (
                    <tr
                      key={r.id}
                      className="cursor-pointer border-b border-stone-100 hover:bg-brand-50/40 dark:border-stone-800 dark:hover:bg-stone-800/50"
                      onClick={() => setSelected(r)}
                    >
                      <td
                        className="px-4 py-3 whitespace-nowrap text-stone-600 dark:text-stone-400"
                        title={`${formatAuditWhenFull(r.createdAt, timezone)} (${tzLabel(timezone)})`}
                      >
                        {formatAuditWhen(r.createdAt, timezone)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-stone-900 dark:text-stone-100">{r.actionLabel}</span>
                          {r.sensitive && (
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
                              Sensitive
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-xs text-stone-500">{r.summary}</p>
                      </td>
                      <td
                        className="px-4 py-3"
                        title="Click to copy entity ID"
                        onClick={(e) => {
                          e.stopPropagation();
                          void navigator.clipboard.writeText(r.entityId);
                        }}
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          {r.entityAdminPath ? (
                            <Link
                              href={r.entityAdminPath}
                              className="font-medium text-brand-800 hover:underline dark:text-brand-300"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {r.entityLabel}
                            </Link>
                          ) : (
                            <span className="font-medium">{r.entityLabel}</span>
                          )}
                          <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-500 dark:bg-stone-800">
                            {r.entityType}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span>{r.actor.name}</span>
                        {kind ? (
                          <span className="ml-1.5 text-xs text-stone-500">{kind}</span>
                        ) : (
                          r.actor.role && (
                            <span className="ml-1.5 text-xs text-stone-500">{r.actor.role}</span>
                          )
                        )}
                      </td>
                      <td className="hidden px-4 py-3 xl:table-cell">{r.branch?.name ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && total > 0 && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AdminSelect
            aria-label="Page size"
            value={String(pageSize)}
            onChange={(v) => setParams({ limit: v, page: 1 })}
            placeholder="Per page"
            options={PAGE_SIZES.map((n) => ({ value: String(n), label: `${n} per page` }))}
            className="w-[9rem]"
            minWidth="min-w-[9rem]"
          />
          {total > pageSize && (
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={total}
              rangeStart={(page - 1) * pageSize + 1}
              rangeEnd={Math.min(page * pageSize, total)}
              onPageChange={(p) => setParams({ page: p })}
            />
          )}
        </div>
      )}

      <AuditLogDetailDrawer
        row={selected}
        timezone={timezone}
        timezoneLabel={tzLabel(timezone)}
        isAdmin={isAdmin}
        onClose={() => setSelected(null)}
      />
    </AdminPage>
  );
}
