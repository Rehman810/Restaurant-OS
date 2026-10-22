"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatPkr } from "@/lib/format";
import { KpiCard } from "@/components/KpiCard";
import { PageHeader } from "@/components/PageHeader";
import { PanelCard } from "@/components/PanelCard";

type Overview = {
  mrrPkr: number;
  arrPkr: number;
  trialsEndingIn7Days: number;
  overdue: { count: number; amountPkr: number };
  gmv: { todayPkr: number; last7DaysPkr: number; last30DaysPkr: number; ordersToday: number };
  activeTenants7d: number;
  stuckOnboarding: number;
  atRiskTenants: Array<{ id: string; displayName: string; slug: string; reason: string }>;
  tenantsByStatus: Array<{ status: string; count: number }>;
};

export default function OverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void api<Overview>("/overview")
      .then(setData)
      .catch(() => setError("Could not load overview."));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" description="Karachi time · subscription and order metrics" />
      {error ? <p className="text-sm text-rose-500">{error}</p> : null}
      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="MRR" value={formatPkr(data.mrrPkr)} />
            <KpiCard label="ARR" value={formatPkr(data.arrPkr)} />
            <KpiCard label="GMV (30 days)" value={formatPkr(data.gmv.last30DaysPkr)} />
            <KpiCard label="Active tenants (7d)" value={String(data.activeTenants7d)} hint="Had at least one order" />
            <KpiCard label="Trials ending (7d)" value={String(data.trialsEndingIn7Days)} />
            <KpiCard label="Overdue invoices" value={formatPkr(data.overdue.amountPkr)} hint={`${data.overdue.count} open`} />
            <KpiCard label="Orders today" value={String(data.gmv.ordersToday)} />
            <KpiCard label="Stuck onboarding" value={String(data.stuckOnboarding)} />
          </div>
          <section className="grid gap-6 lg:grid-cols-2">
            <PanelCard title="Tenants by status">
              <ul className="space-y-2 text-sm">
                {data.tenantsByStatus.map((row) => (
                  <li key={row.status} className="flex justify-between border-b border-slate-50 py-1 dark:border-slate-800">
                    <span>{row.status}</span>
                    <span className="font-medium">{row.count}</span>
                  </li>
                ))}
              </ul>
            </PanelCard>
            <PanelCard title="Needs attention" description="Trials, billing, and health signals">
              <p className="mb-3 text-right">
                <Link href="/tenants" className="text-xs font-medium text-accent-600 hover:underline">View all tenants</Link>
              </p>
              <ul className="space-y-2 text-sm">
                {data.atRiskTenants.length === 0 ? (
                  <li className="text-slate-500">No at-risk tenants right now.</li>
                ) : (
                  data.atRiskTenants.map((t) => (
                    <li key={t.id}>
                      <Link href={`/tenants/${t.id}`} className="font-medium text-accent-600 hover:underline">
                        {t.displayName || t.slug}
                      </Link>
                      <span className="text-slate-500"> — {t.reason}</span>
                    </li>
                  ))
                )}
              </ul>
            </PanelCard>
          </section>
        </>
      ) : (
        !error && <div className="h-48 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      )}
    </div>
  );
}
