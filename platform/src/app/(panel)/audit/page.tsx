"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { formatPktDate } from "@/lib/format";
import type { TenantRow } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { PanelCard } from "@/components/PanelCard";

type AuditRow = {
  id: string;
  action: string;
  actorEmail: string;
  entityType: string;
  entityId: string;
  subjectTenantId: string | null;
  createdAt: string;
  tenant?: { id: string; slug: string; displayName: string } | null;
};

function AuditPageContent() {
  const searchParams = useSearchParams();
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [actionQ, setActionQ] = useState("");
  const [debouncedAction, setDebouncedAction] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fromUrl = searchParams.get("tenantId");
    if (fromUrl) setTenantId(fromUrl);
  }, [searchParams]);

  useEffect(() => {
    void api<{ tenants: TenantRow[] }>("/tenants").then((r) => setTenants(r.tenants)).catch(() => undefined);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedAction(actionQ), 300);
    return () => clearTimeout(t);
  }, [actionQ]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (tenantId) params.set("tenantId", tenantId);
    if (debouncedAction.trim()) params.set("action", debouncedAction.trim());
    void api<{ logs: AuditRow[] }>(`/audit-logs?${params}`)
      .then((res) => setLogs(res.logs))
      .finally(() => setLoading(false));
  }, [tenantId, debouncedAction]);

  return (
    <div className="space-y-6">
      <PageHeader title="Audit log" description="Platform actions with optional tenant filter" />

      <PanelCard>
        <div className="flex flex-wrap gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">Tenant</span>
            <select className="input min-w-[14rem]" value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
              <option value="">All tenants</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.displayName || t.slug}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">Action contains</span>
            <input
              className="input min-w-[12rem]"
              placeholder="e.g. tenant.updated"
              value={actionQ}
              onChange={(e) => setActionQ(e.target.value)}
            />
          </label>
          {tenantId ? (
            <Link href={`/tenants/${tenantId}`} className="self-end text-sm font-medium text-accent-600 hover:underline">
              Open tenant →
            </Link>
          ) : null}
        </div>
      </PanelCard>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/30">
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Actor</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Tenant</th>
              <th className="px-4 py-3 font-medium">Entity</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Loading…</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No entries match your filters.</td></tr>
            ) : (
              logs.map((row) => (
                <tr key={row.id} className="table-row-hover border-b border-slate-50 dark:border-slate-800/80">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-400">{formatPktDate(row.createdAt)}</td>
                  <td className="px-4 py-3">{row.actorEmail || "—"}</td>
                  <td className="px-4 py-3">
                    <code className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">{row.action}</code>
                  </td>
                  <td className="px-4 py-3">
                    {row.tenant ? (
                      <Link href={`/tenants/${row.tenant.id}`} className="font-medium text-accent-600 hover:underline">
                        {row.tenant.displayName || row.tenant.slug}
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {row.entityType}
                    <span className="block font-mono text-[10px] text-slate-400">{row.entityId.slice(0, 8)}…</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AuditPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading audit log…</p>}>
      <AuditPageContent />
    </Suspense>
  );
}
