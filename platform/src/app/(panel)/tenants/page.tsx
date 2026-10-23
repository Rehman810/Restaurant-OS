"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, ExternalLink, Plus, Search } from "lucide-react";
import { api } from "@/lib/api";
import { usePlatformAuth } from "@/lib/auth";
import type { TenantRow } from "@/lib/types";
import { formatPktDate } from "@/lib/format";
import { tenantStorefrontUrl } from "@/lib/tenant-url";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { DataTable, TableEmpty } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";

export default function TenantsPage() {
  const { can } = usePlatformAuth();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState("");
  const [testFilter, setTestFilter] = useState("");
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedQ.trim()) params.set("q", debouncedQ.trim());
    if (status) params.set("status", status);
    if (testFilter) params.set("test", testFilter);
    const query = params.toString();
    void api<{ tenants: TenantRow[] }>(`/tenants${query ? `?${query}` : ""}`)
      .then((res) => {
        setTenants(res.tenants);
        setError("");
      })
      .catch(() => setError("Could not load tenants."))
      .finally(() => setLoading(false));
  }, [debouncedQ, status, testFilter]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Accounts" title="Tenants" description="Restaurant accounts on the platform">
        {can("tenants:write") ? (
          <Link href="/tenants/new" className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden />
            Create tenant
          </Link>
        ) : null}
      </PageHeader>

      <div className="surface-card flex flex-wrap items-center gap-3 p-4">
        <label className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            className="input pl-9"
            placeholder="Search name, slug, email"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search tenants"
          />
        </label>
        <select className="input max-w-[10rem]" value={testFilter} onChange={(e) => setTestFilter(e.target.value)} aria-label="Filter test tenants">
          <option value="">All tenants</option>
          <option value="real">Real only</option>
          <option value="test">Test only</option>
        </select>
        <select className="input max-w-[12rem]" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          {["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED", "ARCHIVED", "LEAD"].map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      {error ? <p className="flash-error">{error}</p> : null}

      <DataTable
        footer={
          loading ? (
            <TableEmpty>Loading tenants…</TableEmpty>
          ) : tenants.length === 0 && !error ? (
            <EmptyState icon={Building2} title="No tenants match your filters" description="Try a different search or status." />
          ) : null
        }
      >
        <thead>
          <tr>
            <th>Tenant</th>
            <th>Status</th>
            <th>Plan</th>
            <th>Owner</th>
            <th>Store</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((t) => {
            const storeUrl = tenantStorefrontUrl(t.slug, t.hostname);
            return (
              <tr key={t.id}>
                <td>
                  <Link href={`/tenants/${t.id}`} className="font-semibold text-accent-600 hover:underline dark:text-accent-300">
                    {t.displayName || t.slug}
                    {t.isTest ? (
                      <span className="ml-2 rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-300">
                        Test
                      </span>
                    ) : null}
                  </Link>
                  <p className="text-xs text-slate-500">{t.slug}</p>
                </td>
                <td>
                  <StatusBadge status={t.status} />
                </td>
                <td>
                  <span>{t.subscription?.plan?.name ?? "—"}</span>
                  {t.subscription?.status ? <p className="text-xs text-slate-500">{t.subscription.status}</p> : null}
                </td>
                <td>
                  <p>{t.ownerName || "—"}</p>
                  <p className="text-xs text-slate-500">{t.ownerEmail || ""}</p>
                </td>
                <td>
                  <a
                    href={storeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-accent-600 hover:underline dark:text-accent-300"
                  >
                    Open
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                </td>
                <td className="whitespace-nowrap text-slate-500">{formatPktDate(t.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>
    </div>
  );
}
