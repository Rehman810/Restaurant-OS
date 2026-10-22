"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Layers, Plus, Users } from "lucide-react";
import { api } from "@/lib/api";
import { usePlatformAuth } from "@/lib/auth";
import { formatPkr } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { parseModuleAccess } from "@/lib/module-access";
import { PLAN_MODULES } from "@/lib/plan-modules";

type PlanRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  interval: string;
  pricePkr: number;
  isActive: boolean;
  entitlements: Record<string, unknown>;
  subscriberCount: number;
};

function enabledModules(ent: Record<string, unknown>) {
  return PLAN_MODULES.filter((m) => parseModuleAccess(ent[m.id], false).read);
}

export default function PlansPage() {
  const { can } = usePlatformAuth();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void api<{ plans: PlanRow[] }>("/plans?all=1")
      .then((r) => setPlans(r.plans))
      .catch(() => setError("Could not load plans."));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalog"
        title="Plans"
        description="Price, billing interval, and module entitlements per license tier"
      >
        {can("plans:write") ? (
          <Link href="/plans/new" className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden />
            New plan
          </Link>
        ) : null}
      </PageHeader>

      {error ? <p className="flash-error">{error}</p> : null}

      {plans.length === 0 && !error ? (
        <div className="surface-card">
          <EmptyState icon={Layers} title="No plans yet" description="Create your first license tier to start onboarding tenants." />
        </div>
      ) : (
        <div className="stagger-in grid gap-4 md:grid-cols-2">
          {plans.map((p) => {
            const modules = enabledModules(p.entitlements);
            return (
              <Link
                key={p.id}
                href={`/plans/${p.id}`}
                className="surface-card group block p-5 transition duration-200 hover:border-accent-400/40 hover:shadow-panel"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-slate-900 group-hover:text-accent-600 dark:text-white dark:group-hover:text-accent-300">
                      {p.name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{p.slug}</p>
                  </div>
                  <StatusBadge status={p.isActive ? "ACTIVE" : "ARCHIVED"} />
                </div>
                <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">
                  {formatPkr(p.pricePkr)}
                  <span className="ml-1 text-sm font-medium text-slate-500">/{p.interval === "YEARLY" ? "yr" : "mo"}</span>
                </p>
                {p.description ? <p className="mt-2 line-clamp-2 text-sm text-slate-500">{p.description}</p> : null}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {modules.slice(0, 6).map((m) => (
                    <span
                      key={m.id}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-white/5 dark:text-slate-300"
                    >
                      {m.label}
                    </span>
                  ))}
                  {modules.length > 6 ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-white/5">
                      +{modules.length - 6}
                    </span>
                  ) : null}
                </div>
                <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <Users className="h-3.5 w-3.5" aria-hidden />
                  {p.subscriberCount} tenant{p.subscriberCount === 1 ? "" : "s"}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
