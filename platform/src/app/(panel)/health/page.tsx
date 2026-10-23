"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Database, Play, UserX } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { usePlatformAuth } from "@/lib/auth";
import { formatRelativePkt } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { PanelCard } from "@/components/PanelCard";
import { DataTable } from "@/components/DataTable";

type HealthPayload = {
  database: { ok: boolean; message?: string };
  schedulers: Array<{
    jobKey: string;
    lastStartedAt: string | null;
    lastFinishedAt: string | null;
    lastSuccessAt: string | null;
    lastError: string | null;
  }>;
  jobKeys: string[];
  databaseBytes: number;
  stuckOnboarding: number;
  atRiskCount: number;
};

type HistoryRow = {
  id: string;
  jobKey: string;
  startedAt: string;
  finishedAt: string | null;
  success: boolean;
  error: string | null;
  triggeredBy: string;
};

export default function HealthPage() {
  const { user } = usePlatformAuth();
  const canRun = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";
  const [data, setData] = useState<HealthPayload | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [message, setMessage] = useState("");
  const [jobFilter, setJobFilter] = useState("");

  const reload = useCallback(() => {
    void api<HealthPayload>("/health").then(setData).catch(() => null);
    const q = jobFilter ? `?jobKey=${encodeURIComponent(jobFilter)}&limit=30` : "?limit=30";
    void api<{ history: HistoryRow[] }>(`/health/jobs/history${q}`).then((r) => setHistory(r.history));
  }, [jobFilter]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function runJob(jobKey: string) {
    if (!canRun) return;
    setMessage("");
    try {
      await api(`/health/jobs/${jobKey}/run`, { method: "POST" });
      setMessage(`Job ${jobKey} finished.`);
      reload();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Job failed.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Reliability" title="System health" description="Database, background jobs, and risk signals" />
      {message ? <p className="text-sm text-accent-400">{message}</p> : null}
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
                {canRun ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {data.schedulers.map((job) => (
                <tr key={job.jobKey}>
                  <td className="font-mono text-xs">{job.jobKey}</td>
                  <td>{job.lastSuccessAt ? formatRelativePkt(job.lastSuccessAt) : "—"}</td>
                  <td className={job.lastError ? "text-rose-400" : "text-slate-500"}>{job.lastError || "—"}</td>
                  {canRun ? (
                    <td>
                      <button type="button" className="btn-ghost text-xs" onClick={() => void runJob(job.jobKey)}>
                        <Play className="h-3 w-3" aria-hidden />
                        Run now
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </DataTable>

          <PanelCard title="Job run history" description="Last runs with duration and trigger">
            <select className="input mb-4 max-w-xs" value={jobFilter} onChange={(e) => setJobFilter(e.target.value)}>
              <option value="">All jobs</option>
              {data.jobKeys.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <DataTable>
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Started</th>
                  <th>Duration</th>
                  <th>Trigger</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => {
                  const ms =
                    h.finishedAt && h.startedAt
                      ? new Date(h.finishedAt).getTime() - new Date(h.startedAt).getTime()
                      : null;
                  return (
                    <tr key={h.id}>
                      <td className="font-mono text-xs">{h.jobKey}</td>
                      <td className="text-xs text-slate-500">{formatRelativePkt(h.startedAt)}</td>
                      <td>{ms != null ? `${(ms / 1000).toFixed(1)}s` : "…"}</td>
                      <td className="text-xs">{h.triggeredBy}</td>
                      <td className={h.success ? "text-emerald-400" : h.error ? "text-rose-400" : "text-slate-400"}>
                        {h.finishedAt ? (h.success ? "OK" : h.error || "Failed") : "Running"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          </PanelCard>
        </>
      ) : (
        <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
      )}
    </div>
  );
}
