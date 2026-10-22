"use client";

import { useEffect, useState } from "react";
import { Activity, Database, UserX } from "lucide-react";
import { api } from "@/lib/api";
import { formatRelativePkt } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { PanelCard } from "@/components/PanelCard";
import { DataTable } from "@/components/DataTable";

type HealthPayload = {
  database: { ok: boolean; message?: string };
  schedulers: Array<{
    jobKey: string;
    lastSuccessAt: string | null;
    lastError: string | null;
  }>;
  databaseBytes: number;
  stuckOnboarding: number;
  atRiskCount: number;
};

export default function HealthPage() {
  const [data, setData] = useState<HealthPayload | null>(null);

  useEffect(() => {
    void api<HealthPayload>("/health").then(setData).catch(() => null);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Reliability" title="System health" description="Database, background jobs, and risk signals" />
      {data ? (
        <>
          <div className="stagger-in grid gap-4 sm:grid-cols-3">
            <PanelCard>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Database</p>
                  <p className={`mt-2 text-lg font-semibold ${data.database.ok ? "text-emerald-400" : "text-rose-400"}`}>
                    {data.database.ok ? "Connected" : data.database.message || "Error"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">~{(data.databaseBytes / 1_000_000).toFixed(1)} MB</p>
                </div>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                  <Database className="h-4 w-4" aria-hidden />
                </span>
              </div>
            </PanelCard>
            <PanelCard>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Onboarding</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">{data.stuckOnboarding}</p>
                  <p className="mt-1 text-sm text-slate-500">Stuck tenants</p>
                </div>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                  <Activity className="h-4 w-4" aria-hidden />
                </span>
              </div>
            </PanelCard>
            <PanelCard>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">At risk</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">{data.atRiskCount}</p>
                  <p className="mt-1 text-sm text-slate-500">Needs operator review</p>
                </div>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/15 text-rose-400">
                  <UserX className="h-4 w-4" aria-hidden />
                </span>
              </div>
            </PanelCard>
          </div>
          <DataTable>
            <thead>
              <tr>
                <th>Job</th>
                <th>Last success</th>
                <th>Last error</th>
              </tr>
            </thead>
            <tbody>
              {data.schedulers.map((job) => (
                <tr key={job.jobKey}>
                  <td className="font-mono text-xs">{job.jobKey}</td>
                  <td>{job.lastSuccessAt ? formatRelativePkt(job.lastSuccessAt) : "—"}</td>
                  <td className={job.lastError ? "text-rose-400" : "text-slate-500"}>{job.lastError || "—"}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </>
      ) : (
        <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
      )}
    </div>
  );
}
