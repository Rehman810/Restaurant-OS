"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, ScrollText } from "lucide-react";
import { api, downloadAuditLogCsv } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Pagination } from "@/components/Pagination";
import { PAGE_SIZE } from "@/lib/pagination";
import {
  AdminEmptyState,
  AdminFilterBar,
  AdminPage,
  AdminPageHeader,
  SearchField,
} from "@/components/admin/ui";

type AuditRow = {
  id: string;
  createdAt: string;
  action: string;
  entityType: string;
  entityId: string;
  actorRole: string | null;
  reason: string | null;
  ip: string | null;
  before: unknown;
  after: unknown;
  meta: unknown;
  actor: { id: string; name: string; email: string; role: string } | null;
  branch: { id: string; name: string; code: string } | null;
};

function formatJson(v: unknown) {
  if (v == null) return "—";
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export default function AuditLogPage() {
  const { user } = useAuth();
  const allowed = user?.role === "ADMIN" || user?.role === "MANAGER";
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<AuditRow | null>(null);

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError("");
    try {
      const offset = (page - 1) * PAGE_SIZE.list;
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE.list),
        offset: String(offset),
      });
      if (action.trim()) params.set("action", action.trim());
      if (entityType.trim()) params.set("entityType", entityType.trim());
      const data = await api<{ logs: AuditRow[]; total: number }>(`/admin/audit-logs?${params}`);
      setRows(data.logs);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load audit log.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [allowed, page, action, entityType]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [action, entityType]);

  async function exportCsv() {
    const params = new URLSearchParams();
    if (action.trim()) params.set("action", action.trim());
    try {
      await downloadAuditLogCsv(params.toString());
    } catch {
      setError("Could not export CSV.");
    }
  }

  if (!allowed) {
    return (
      <AdminPage>
        <p className="text-sm text-stone-500">You do not have access to the audit log.</p>
      </AdminPage>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE.list));

  return (
    <AdminPage>
      <AdminPageHeader
        icon={ScrollText}
        title="Audit log"
        description="Append-only record of sensitive actions across orders, menu, settings, and staff."
        actions={
          <button type="button" className="btn-ghost" onClick={exportCsv}>
            <Download size={16} /> Export CSV
          </button>
        }
      />

      <AdminFilterBar>
        <SearchField
          value={action}
          onChange={setAction}
          placeholder="Filter by action code…"
          className="max-w-xs"
        />
        <SearchField
          value={entityType}
          onChange={setEntityType}
          placeholder="Entity type (e.g. order)…"
          className="max-w-xs"
        />
      </AdminFilterBar>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {!loading && rows.length === 0 && !error && (
        <AdminEmptyState
          icon={ScrollText}
          title="No audit entries"
          description="Actions will appear here when staff change orders, menu, settings, or branches."
        />
      )}

      {rows.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-100 bg-stone-50 text-xs uppercase tracking-wide text-stone-500 dark:border-stone-700 dark:bg-stone-800/80">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Branch</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer border-b border-stone-100 hover:bg-brand-50/40 dark:border-stone-800 dark:hover:bg-stone-800/50"
                  onClick={() => setSelected(r)}
                >
                  <td className="px-4 py-3 whitespace-nowrap text-stone-600 dark:text-stone-400">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{r.action}</td>
                  <td className="px-4 py-3">
                    <span className="text-stone-500">{r.entityType}</span>
                    <span className="ml-1 font-mono text-xs text-stone-400">{r.entityId.slice(0, 8)}…</span>
                  </td>
                  <td className="px-4 py-3">{r.actor?.name || "—"}</td>
                  <td className="px-4 py-3">{r.branch?.name || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE_SIZE.list && (
        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={total}
          rangeStart={(page - 1) * PAGE_SIZE.list + 1}
          rangeEnd={Math.min(page * PAGE_SIZE.list, total)}
          onPageChange={setPage}
          className="mt-4"
        />
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/50 p-4 sm:items-center"
          role="presentation"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-stone-200 bg-white p-5 shadow-xl dark:border-stone-600 dark:bg-stone-900"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-50">{selected.action}</h2>
            <p className="mt-1 text-xs text-stone-500">
              {selected.entityType} · {selected.entityId}
            </p>
            {selected.reason && <p className="mt-2 text-sm text-stone-600">Reason: {selected.reason}</p>}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase text-stone-500">Before</p>
                <pre className="mt-1 max-h-48 overflow-auto rounded-xl bg-stone-50 p-3 text-xs dark:bg-stone-800">
                  {formatJson(selected.before ?? selected.meta)}
                </pre>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-stone-500">After</p>
                <pre className="mt-1 max-h-48 overflow-auto rounded-xl bg-stone-50 p-3 text-xs dark:bg-stone-800">
                  {formatJson(selected.after ?? selected.meta)}
                </pre>
              </div>
            </div>
            <button type="button" className="btn-primary mt-4 w-full" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
