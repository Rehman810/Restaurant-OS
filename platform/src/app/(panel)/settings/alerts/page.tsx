"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { usePlatformAuth } from "@/lib/auth";
import { ForbiddenPage } from "@/components/RequirePermission";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { PanelCard } from "@/components/PanelCard";

type Rule = {
  id: string;
  name: string;
  actionPattern: string;
  channel: string;
  target: string;
  enabled: boolean;
};

export default function AlertRulesPage() {
  const { can } = usePlatformAuth();
  const [rules, setRules] = useState<Rule[]>([]);
  const [name, setName] = useState("");
  const [actionPattern, setActionPattern] = useState("");
  const [target, setTarget] = useState("");
  const [message, setMessage] = useState("");

  function reload() {
    void api<{ rules: Rule[] }>("/alert-rules").then((r) => setRules(r.rules)).catch(() => undefined);
  }

  useEffect(() => {
    if (can("security:write")) reload();
  }, [can]);

  if (!can("security:write")) return <ForbiddenPage />;

  async function createRule(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    try {
      await api("/alert-rules", {
        method: "POST",
        body: JSON.stringify({ name, actionPattern, target, channel: "EMAIL" }),
      });
      setName("");
      setActionPattern("");
      setTarget("");
      setMessage("Rule created.");
      reload();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not create rule.");
    }
  }

  return (
    <div className="space-y-6">
      <BackLink href="/settings" label="Settings" />
      <PageHeader title="Alert rules" description="Email or Slack webhook when audit actions match a pattern." />
      {message ? <p className="flash-ok">{message}</p> : null}
      <PanelCard title="New rule">
        <form className="grid gap-3" onSubmit={createRule}>
          <label className="text-sm">
            <span className="field-label">Name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="text-sm">
            <span className="field-label">Action contains</span>
            <input className="input font-mono text-xs" placeholder="subscription.updated" value={actionPattern} onChange={(e) => setActionPattern(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="field-label">Email or Slack webhook URL</span>
            <input className="input" value={target} onChange={(e) => setTarget(e.target.value)} required />
          </label>
          <button type="submit" className="btn-primary w-fit">Add rule</button>
        </form>
      </PanelCard>
      <PanelCard title="Active rules">
        <ul className="space-y-2 text-sm">
          {rules.map((r) => (
            <li key={r.id} className="rounded-xl border border-white/10 p-3">
              <p className="font-medium">{r.name}</p>
              <p className="text-xs text-slate-500">Match: {r.actionPattern || "any"} → {r.channel} {r.target}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-slate-500">
          <Link href="/status" className="text-accent-400 hover:underline">Public status page</Link> uses platform settings incidents.
        </p>
      </PanelCard>
    </div>
  );
}
