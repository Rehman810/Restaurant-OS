"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatRelativePkt } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { PanelCard } from "@/components/PanelCard";

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
      <PageHeader title="System health" description="Database, background jobs, and risk signals" />
      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <PanelCard title="Database">
              <p className={`text-lg font-semibold ${data.database.ok ? "text-emerald-600" : "text-rose-600"}`}>
                {data.database.ok ? "Connected" : data.database.message || "Error"}
              </p>
              <p className="mt-1 text-sm text-slate-500">~{(data.databaseBytes / 1_000_000).toFixed(1)} MB</p>
            </PanelCard>
            <PanelCard title="Onboarding">
              <p className="text-2xl font-semibold">{data.stuckOnboarding}</p>
              <p className="text-sm text-slate-500">Stuck tenants</p>
            </PanelCard>
            <PanelCard title="At risk">
              <p className="text-2xl font-semibold">{data.atRiskCount}</p>
              <p className="text-sm text-slate-500">Needs operator review</p>
            </PanelCard>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/30">
                  <th className="px-4 py-3 font-medium">Job</th>
                  <th className="px-4 py-3 font-medium">Last success</th>
                  <th className="px-4 py-3 font-medium">Last error</th>
                </tr>
              </thead>
              <tbody>
                {data.schedulers.map((job) => (
                  <tr key={job.jobKey} className="table-row-hover border-b border-slate-50 dark:border-slate-800/80">
                    <td className="px-4 py-3 font-mono text-xs">{job.jobKey}</td>
                    <td className="px-4 py-3">{job.lastSuccessAt ? formatRelativePkt(job.lastSuccessAt) : "—"}</td>
                    <td className="px-4 py-3 text-rose-500">{job.lastError || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="h-32 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      )}
    </div>
  );
}
