"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CircleDollarSign,
  Clock,
  Receipt,
  ShoppingBag,
  TrendingUp,
  UserCheck,
  Wallet,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatPkr } from "@/lib/format";
import { KpiCard } from "@/components/KpiCard";
import { PageHeader } from "@/components/PageHeader";
import { PanelCard } from "@/components/PanelCard";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";

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

const STATUS_BAR: Record<string, string> = {
  ACTIVE: "bg-emerald-400",
  TRIAL: "bg-sky-400",
  PAST_DUE: "bg-amber-400",
  SUSPENDED: "bg-orange-400",
  CANCELLED: "bg-rose-400",
  ARCHIVED: "bg-slate-400",
  LEAD: "bg-violet-400",
};

export default function OverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void api<Overview>("/overview")
      .then(setData)
      .catch(() => setError("Could not load overview."));
  }, []);

  const totalTenants = useMemo(
    () => data?.tenantsByStatus.reduce((sum, row) => sum + row.count, 0) ?? 0,
    [data]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Live ops"
        title="Overview"
        description="Karachi time · subscription, billing, and order metrics across all tenants"
      />
      {error ? <p className="flash-error">{error}</p> : null}
      {data ? (
        <>
          <div className="stagger-in grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="MRR" value={formatPkr(data.mrrPkr)} icon={Wallet} hint="Recurring this month" />
            <KpiCard label="ARR" value={formatPkr(data.arrPkr)} icon={TrendingUp} hint="Annualized run rate" />
            <KpiCard label="GMV (30 days)" value={formatPkr(data.gmv.last30DaysPkr)} icon={CircleDollarSign} hint={`Today ${formatPkr(data.gmv.todayPkr)}`} />
            <KpiCard
              label="Active tenants (7d)"
              value={String(data.activeTenants7d)}
              icon={UserCheck}
              hint="Had at least one order"
              tone="success"
            />
            <KpiCard
              label="Trials ending (7d)"
              value={String(data.trialsEndingIn7Days)}
              icon={Clock}
              tone={data.trialsEndingIn7Days > 0 ? "warning" : "default"}
            />
            <KpiCard
              label="Overdue invoices"
              value={formatPkr(data.overdue.amountPkr)}
              hint={`${data.overdue.count} open`}
              icon={Receipt}
              tone={data.overdue.count > 0 ? "danger" : "default"}
            />
            <KpiCard label="Orders today" value={String(data.gmv.ordersToday)} icon={ShoppingBag} />
            <KpiCard
              label="Stuck onboarding"
              value={String(data.stuckOnboarding)}
              icon={AlertTriangle}
              tone={data.stuckOnboarding > 0 ? "warning" : "default"}
            />
          </div>
          <section className="grid gap-6 lg:grid-cols-2">
            <PanelCard title="Tenants by status" description={totalTenants ? `${totalTenants} accounts` : "No tenants yet"}>
              {data.tenantsByStatus.length === 0 ? (
                <EmptyState icon={Building2} title="No tenant status data yet" />
              ) : (
                <ul className="space-y-3">
                  {data.tenantsByStatus.map((row) => {
                    const pct = totalTenants ? Math.round((row.count / totalTenants) * 100) : 0;
                    return (
                      <li key={row.status}>
                        <div className="mb-1.5 flex items-center justify-between gap-3">
                          <StatusBadge status={row.status} />
                          <span className="text-sm font-semibold tabular-nums">{row.count}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                          <div
                            className={`h-full rounded-full ${STATUS_BAR[row.status] || "bg-accent-400"}`}
                            style={{ width: `${Math.max(pct, row.count > 0 ? 6 : 0)}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </PanelCard>
            <PanelCard
              title="Needs attention"
              description="Trials, billing, and health signals"
              actions={
                <Link href="/tenants" className="text-xs font-semibold text-accent-500 hover:text-accent-400">
                  View all tenants
                </Link>
              }
            >
              {data.atRiskTenants.length === 0 ? (
                <EmptyState
                  icon={UserCheck}
                  title="No at-risk tenants right now"
                  description="Trials, overdue invoices, and stuck onboarding will show up here."
                />
              ) : (
                <ul className="space-y-2">
                  {data.atRiskTenants.map((t) => (
                    <li
                      key={t.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.03]"
                    >
                      <Link href={`/tenants/${t.id}`} className="text-sm font-semibold text-accent-600 hover:underline dark:text-accent-300">
                        {t.displayName || t.slug}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-500">{t.reason}</p>
                    </li>
                  ))}
                </ul>
              )}
            </PanelCard>
          </section>
        </>
      ) : (
        !error && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200/80 dark:bg-white/5" />
            ))}
          </div>
        )
      )}
    </div>
  );
}
