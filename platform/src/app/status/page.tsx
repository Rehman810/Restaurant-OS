"use client";

import { useEffect, useState } from "react";
import { getApiUrl } from "@/lib/api";
import { formatPktDate } from "@/lib/format";

type StatusPayload = {
  generatedAt: string;
  maintenance: { active?: boolean; message?: string };
  statusPage: {
    headline?: string;
    incidents?: Array<{ id: string; title: string; status: string; updatedAt: string; body?: string }>;
  };
};

export default function PublicStatusPage() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch(`${getApiUrl()}/platform/status/public`, { credentials: "omit" })
      .then(async (res) => {
        if (!res.ok) throw new Error("unavailable");
        return res.json() as Promise<StatusPayload>;
      })
      .then(setData)
      .catch(() => setError("Status is temporarily unavailable."));
  }, []);

  const headline = data?.maintenance?.active
    ? data.maintenance.message || "Maintenance in progress"
    : data?.statusPage?.headline || "All systems operational";

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-16 text-slate-100">
      <div className="mx-auto max-w-xl space-y-8">
        <header>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-400">Restaurant OS</p>
          <h1 className="mt-2 text-2xl font-semibold">System status</h1>
          {data ? <p className="mt-1 text-sm text-slate-400">Updated {formatPktDate(data.generatedAt)}</p> : null}
        </header>
        {error ? <p className="text-amber-300">{error}</p> : null}
        {data ? (
          <>
            <div
              className={`rounded-2xl border p-6 ${
                data.maintenance?.active ? "border-amber-500/40 bg-amber-500/10" : "border-emerald-500/30 bg-emerald-500/10"
              }`}
            >
              <p className="text-lg font-medium">{headline}</p>
            </div>
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Incidents</h2>
              {(data.statusPage.incidents?.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-500">No active incidents.</p>
              ) : (
                <ul className="space-y-3">
                  {data.statusPage.incidents!.map((inc) => (
                    <li key={inc.id} className="rounded-xl border border-white/10 p-4 text-sm">
                      <p className="font-medium">{inc.title}</p>
                      <p className="text-xs text-slate-500">{inc.status} · {formatPktDate(inc.updatedAt)}</p>
                      {inc.body ? <p className="mt-2 whitespace-pre-wrap text-slate-300">{inc.body}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : !error ? (
          <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
        ) : null}
      </div>
    </div>
  );
}
