"use client";

import { FormEvent, useEffect, useState } from "react";
import { Flag } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { usePlatformAuth } from "@/lib/auth";
import { ForbiddenPage } from "@/components/RequirePermission";
import { PageHeader } from "@/components/PageHeader";
import { PanelCard } from "@/components/PanelCard";

type FlagRow = { id: string; key: string; description: string; defaultEnabled: boolean };

export default function FeatureFlagsPage() {
  const { can } = usePlatformAuth();
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");

  function reload() {
    void api<{ flags: FlagRow[] }>("/feature-flags").then((r) => setFlags(r.flags)).catch(() => undefined);
  }

  useEffect(() => {
    if (can("flags:read")) reload();
  }, [can]);

  if (!can("flags:read")) return <ForbiddenPage />;

  async function createFlag(e: FormEvent) {
    e.preventDefault();
    if (!can("flags:write")) return;
    setMessage("");
    try {
      await api("/feature-flags", {
        method: "POST",
        body: JSON.stringify({ key, description, defaultEnabled: false }),
      });
      setKey("");
      setDescription("");
      setMessage("Flag created.");
      reload();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not create flag.");
    }
  }

  async function toggleDefault(flag: FlagRow) {
    if (!can("flags:write")) return;
    await api(`/feature-flags/${flag.id}`, {
      method: "PATCH",
      body: JSON.stringify({ defaultEnabled: !flag.defaultEnabled }),
    });
    reload();
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="System" title="Feature flags" description="Gradual rollouts and per-tenant overrides from tenant detail.">
        <Flag className="h-5 w-5 text-accent-400" aria-hidden />
      </PageHeader>
      {message ? <p className="flash-ok">{message}</p> : null}
      {can("flags:write") ? (
        <PanelCard title="New flag">
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={createFlag}>
            <label className="text-sm">
              <span className="field-label">Key</span>
              <input className="input font-mono text-xs" value={key} onChange={(e) => setKey(e.target.value)} required />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="field-label">Description</span>
              <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <button type="submit" className="btn-primary sm:col-span-2">Create</button>
          </form>
        </PanelCard>
      ) : null}
      <PanelCard title="Flags">
        <ul className="divide-y divide-white/5">
          {flags.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div>
                <p className="font-mono text-accent-300">{f.key}</p>
                <p className="text-slate-500">{f.description || "—"}</p>
              </div>
              <button
                type="button"
                className="btn-secondary text-xs"
                disabled={!can("flags:write")}
                onClick={() => void toggleDefault(f)}
              >
                Default: {f.defaultEnabled ? "ON" : "OFF"}
              </button>
            </li>
          ))}
        </ul>
      </PanelCard>
    </div>
  );
}
