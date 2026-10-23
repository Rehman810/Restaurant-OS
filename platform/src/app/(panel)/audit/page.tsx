"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download, ScrollText } from "lucide-react";
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
  actorId: string | null;
  entityType: string;
  entityId: string;
  subjectTenantId: string | null;
  createdAt: string;
  before: unknown;
  after: unknown;
  tenant?: { id: string; slug: string; displayName: string } | null;
};

function AuditPageContent() {
  const searchParams = useSearchParams();
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [actionQ, setActionQ] = useState("");
  const [actorEmail, setActorEmail] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [debouncedAction, setDebouncedAction] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
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
    if (actorEmail.trim()) params.set("actorEmail", actorEmail.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    void api<{ logs: AuditRow[] }>(`/audit-logs?${params}`)
      .then((res) => setLogs(res.logs))
      .finally(() => setLoading(false));
  }, [tenantId, debouncedAction, actorEmail, from, to]);

  const exportUrl = `/api/proxy/audit-logs/export.csv?${new URLSearchParams({
    ...(tenantId ? { tenantId } : {}),
    ...(debouncedAction ? { action: debouncedAction } : {}),
    ...(actorEmail ? { actorEmail } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  })}`;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Security" title="Audit log" description="Platform actions with filters and change diffs">
        <a href={exportUrl} className="btn-secondary">
          <Download className="h-4 w-4" aria-hidden />
          Export CSV
        </a>
      </PageHeader>

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
          <label className="text-sm">
            <span className="field-label">Actor email</span>
            <input className="input min-w-[12rem]" value={actorEmail} onChange={(e) => setActorEmail(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="field-label">From</span>
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="field-label">To</span>
            <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
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
            <th>Changes</th>
          </tr>
        </thead>
        <tbody>
          {!loading &&
            logs.map((row) => (
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
                <td className="text-xs">
                  {row.before || row.after ? (
                    <button type="button" className="text-accent-400 hover:underline" onClick={() => setExpanded(expanded === row.id ? null : row.id)}>
                      {expanded === row.id ? "Hide" : "View diff"}
                    </button>
                  ) : (
                    <span className="text-slate-500">{row.entityType}</span>
                  )}
                  {expanded === row.id ? (
                    <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-black/30 p-2 text-[10px] text-slate-300">
                      {JSON.stringify({ before: row.before, after: row.after }, null, 2)}
                    </pre>
                  ) : null}
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
