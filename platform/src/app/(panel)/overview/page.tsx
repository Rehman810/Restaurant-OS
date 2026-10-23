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
  rangeDays: number;
  mrrPkr: number;
  arrPkr: number;
  trialsEndingIn7Days: number;
  overdue: { count: number; amountPkr: number };
  gmv: { todayPkr: number; last7DaysPkr: number; last30DaysPkr: number; rangePkr: number; ordersToday: number };
  activeTenants7d: number;
  stuckOnboarding: number;
  atRiskTenants: Array<{ id: string; displayName: string; slug: string; reason: string }>;
  tenantsByStatus: Array<{ status: string; count: number }>;
  gmvTrend: Array<{ date: string; collectedPkr: number }>;
  mrrMovement: { newPkr: number; expansionPkr: number; contractionPkr: number; churnPkr: number; netPkr: number };
  conversion: { trialToPaidRate: number; churnRate: number; arpaPkr: number };
  funnel: { created: number; onboardingComplete: number; firstOrder: number; paid: number };
  needsAttention: Array<{ id: string; kind: string; label: string; href: string }>;
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

const RANGES = [7, 30, 90] as const;

export default function OverviewPage() {
  const [range, setRange] = useState<number>(30);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void api<Overview>(`/overview?range=${range}`)
      .then(setData)
      .catch(() => setError("Could not load overview."));
  }, [range]);

  const totalTenants = useMemo(
    () => data?.tenantsByStatus.reduce((sum, row) => sum + row.count, 0) ?? 0,
    [data]
  );

  const gmvMax = useMemo(
    () => Math.max(1, ...(data?.gmvTrend.map((p) => p.collectedPkr) ?? [1])),
    [data]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Live ops"
        title="Overview"
        description="Karachi time · subscription, billing, and order metrics (test tenants excluded)"
      >
        <div className="flex gap-1 rounded-xl border border-white/10 p-1">
          {RANGES.map((d) => (
            <button
              key={d}
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${range === d ? "bg-accent-500/20 text-accent-200" : "text-slate-400"}`}
              onClick={() => setRange(d)}
            >
              {d}d
            </button>
          ))}
        </div>
      </PageHeader>
      {error ? <p className="flash-error">{error}</p> : null}
      {data ? (
        <>
          <div className="stagger-in grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="MRR" value={formatPkr(data.mrrPkr)} icon={Wallet} hint="Recurring this month" />
            <KpiCard label="ARR" value={formatPkr(data.arrPkr)} icon={TrendingUp} hint="Annualized run rate" />
            <KpiCard
              label={`GMV (${data.rangeDays}d)`}
              value={formatPkr(data.gmv.rangePkr)}
              icon={CircleDollarSign}
              hint={`Today ${formatPkr(data.gmv.todayPkr)}`}
            />
            <KpiCard
              label="ARPA"
              value={formatPkr(data.conversion.arpaPkr)}
              icon={Wallet}
              hint={`Trial→paid ${(data.conversion.trialToPaidRate * 100).toFixed(0)}%`}
            />
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
          </div>

          <section className="grid gap-6 lg:grid-cols-2">
            <PanelCard title="GMV trend" description={`Daily collected PKR · last ${data.rangeDays} days`}>
              {data.gmvTrend.length === 0 ? (
                <EmptyState icon={TrendingUp} title="No GMV in this window" />
              ) : (
                <ul className="flex h-32 items-end gap-0.5">
                  {data.gmvTrend.map((p) => (
                    <li key={p.date} className="flex-1" title={`${p.date}: ${formatPkr(p.collectedPkr)}`}>
                      <div
                        className="mx-auto w-full max-w-[12px] rounded-t bg-accent-500/70"
                        style={{ height: `${Math.max(4, (p.collectedPkr / gmvMax) * 100)}%` }}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </PanelCard>
            <PanelCard title="MRR movement" description={`Last ${data.rangeDays} days (approx.)`}>
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between"><span className="text-slate-500">New</span><span className="text-emerald-400">+{formatPkr(data.mrrMovement.newPkr)}</span></li>
                <li className="flex justify-between"><span className="text-slate-500">Expansion</span><span className="text-emerald-300">+{formatPkr(data.mrrMovement.expansionPkr)}</span></li>
                <li className="flex justify-between"><span className="text-slate-500">Contraction</span><span className="text-amber-300">−{formatPkr(data.mrrMovement.contractionPkr)}</span></li>
                <li className="flex justify-between"><span className="text-slate-500">Churn</span><span className="text-rose-400">−{formatPkr(data.mrrMovement.churnPkr)}</span></li>
                <li className="flex justify-between border-t border-white/10 pt-2 font-semibold">
                  <span>Net</span>
                  <span>{formatPkr(data.mrrMovement.netPkr)}</span>
                </li>
              </ul>
            </PanelCard>
          </section>

          <PanelCard title="Signup funnel" description={`Cohort created in last ${data.rangeDays} days`}>
            <div className="grid gap-3 sm:grid-cols-4 text-center text-sm">
              {[
                { label: "Created", value: data.funnel.created },
                { label: "Onboarding done", value: data.funnel.onboardingComplete },
                { label: "First order", value: data.funnel.firstOrder },
                { label: "Paid", value: data.funnel.paid },
              ].map((step) => (
                <div key={step.label} className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-4">
                  <p className="text-2xl font-semibold tabular-nums">{step.value}</p>
                  <p className="mt-1 text-xs text-slate-500">{step.label}</p>
                </div>
              ))}
            </div>
          </PanelCard>

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
            <PanelCard title="Needs attention" description="Trials, billing, and health signals">
              {data.needsAttention.length === 0 && data.atRiskTenants.length === 0 && data.stuckOnboarding === 0 ? (
                <EmptyState icon={UserCheck} title="All clear" description="Nothing urgent right now." />
              ) : (
                <ul className="space-y-2">
                  {data.stuckOnboarding > 0 ? (
                    <li className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm">
                      <Link href="/tenants?status=TRIAL" className="font-semibold text-amber-200 hover:underline">
                        {data.stuckOnboarding} stuck in onboarding
                      </Link>
                    </li>
                  ) : null}
                  {data.needsAttention.map((item) => (
                    <li key={item.id} className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.03]">
                      <Link href={item.href} className="text-sm font-semibold text-accent-600 hover:underline dark:text-accent-300">
                        {item.label}
                      </Link>
                    </li>
                  ))}
                  {data.atRiskTenants.map((t) => (
                    <li key={t.id} className="rounded-xl border border-slate-100 px-3 py-2 dark:border-white/[0.06]">
                      <Link href={`/tenants/${t.id}`} className="text-sm font-semibold text-accent-400 hover:underline">
                        {t.displayName || t.slug}
                      </Link>
                      <p className="text-xs text-slate-500">{t.reason}</p>
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
