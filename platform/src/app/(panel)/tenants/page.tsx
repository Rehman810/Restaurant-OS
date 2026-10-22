"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { usePlatformAuth } from "@/lib/auth";
import type { TenantRow } from "@/lib/types";
import { formatPktDate } from "@/lib/format";
import { tenantStorefrontUrl } from "@/lib/tenant-url";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";

export default function TenantsPage() {
  const { can } = usePlatformAuth();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState("");
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
    const query = params.toString();
    void api<{ tenants: TenantRow[] }>(`/tenants${query ? `?${query}` : ""}`)
      .then((res) => {
        setTenants(res.tenants);
        setError("");
      })
      .catch(() => setError("Could not load tenants."))
      .finally(() => setLoading(false));
  }, [debouncedQ, status]);

  return (
    <div className="space-y-6">
      <PageHeader title="Tenants" description="Restaurant accounts on the platform">
        {can("tenants:write") ? (
          <Link href="/tenants/new" className="btn-primary gap-2">
            <Plus className="h-4 w-4" />
            Create tenant
          </Link>
        ) : null}
      </PageHeader>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <input
          className="input max-w-xs"
          placeholder="Search name, slug, email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input max-w-[10rem]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED", "ARCHIVED", "LEAD"].map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      {error ? <p className="text-sm text-rose-500">{error}</p> : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/30">
              <th className="px-4 py-3 font-medium">Tenant</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Store</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => {
              const storeUrl = tenantStorefrontUrl(t.slug, t.hostname);
              return (
                <tr key={t.id} className="table-row-hover border-b border-slate-50 dark:border-slate-800/80">
                  <td className="px-4 py-3">
                    <Link href={`/tenants/${t.id}`} className="font-medium text-accent-600 hover:underline">
                      {t.displayName || t.slug}
                    </Link>
                    <p className="text-xs text-slate-500">{t.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3">
                    <span>{t.subscription?.plan?.name ?? "—"}</span>
                    {t.subscription?.status ? <p className="text-xs text-slate-500">{t.subscription.status}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    <p>{t.ownerName || "—"}</p>
                    <p className="text-xs text-slate-500">{t.ownerEmail || ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={storeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-accent-600 hover:underline"
                    >
                      Open
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatPktDate(t.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">Loading…</p>
        ) : tenants.length === 0 && !error ? (
          <p className="p-8 text-center text-sm text-slate-500">No tenants match your filters.</p>
        ) : null}
      </div>
    </div>
  );
}
