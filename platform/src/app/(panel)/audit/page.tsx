"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ScrollText } from "lucide-react";
import { api } from "@/lib/api";
import { formatPktDate } from "@/lib/format";
import type { TenantRow } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { PanelCard } from "@/components/PanelCard";
import { DataTable, TableEmpty } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";

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
      <PageHeader eyebrow="Security" title="Audit log" description="Platform actions with optional tenant filter" />

      <PanelCard>
        <div className="flex flex-wrap gap-3">
          <label className="text-sm">
            <span className="field-label">Tenant</span>
            <select className="input min-w-[14rem]" value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
              <option value="">All tenants</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.displayName || t.slug}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="field-label">Action contains</span>
            <input
              className="input min-w-[12rem]"
              placeholder="e.g. tenant.updated"
              value={actionQ}
              onChange={(e) => setActionQ(e.target.value)}
            />
          </label>
          {tenantId ? (
            <Link href={`/tenants/${tenantId}`} className="self-end pb-2 text-sm font-semibold text-accent-500 hover:underline">
              Open tenant →
            </Link>
          ) : null}
        </div>
      </PanelCard>

      <DataTable
        footer={
          loading ? (
            <TableEmpty>Loading…</TableEmpty>
          ) : logs.length === 0 ? (
            <EmptyState icon={ScrollText} title="No entries match your filters" />
          ) : null
        }
      >
        <thead>
          <tr>
            <th>When</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Tenant</th>
            <th>Entity</th>
          </tr>
        </thead>
        <tbody>
          {!loading && logs.map((row) => (
            <tr key={row.id}>
              <td className="whitespace-nowrap text-slate-500">{formatPktDate(row.createdAt)}</td>
              <td>{row.actorEmail || "—"}</td>
              <td>
                <code className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-white/10">{row.action}</code>
              </td>
              <td>
                {row.tenant ? (
                  <Link href={`/tenants/${row.tenant.id}`} className="font-semibold text-accent-600 hover:underline dark:text-accent-300">
                    {row.tenant.displayName || row.tenant.slug}
                  </Link>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="text-xs text-slate-500">
                {row.entityType}
                <span className="block font-mono text-[10px] text-slate-400">{row.entityId.slice(0, 8)}…</span>
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}

export default function AuditPage() {
  return (
    <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-white/5" />}>
      <AuditPageContent />
    </Suspense>
  );
}
