"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { usePlatformAuth } from "@/lib/auth";
import { ForbiddenPage } from "@/components/RequirePermission";
import { PageHeader } from "@/components/PageHeader";
import { PanelCard } from "@/components/PanelCard";

type SettingsPayload = {
  version: number;
  data: Record<string, unknown>;
};

export default function SettingsPage() {
  const { can } = usePlatformAuth();
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [supportEmail, setSupportEmail] = useState("");
  const [trialDays, setTrialDays] = useState(14);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    void api<SettingsPayload>("/settings")
      .then((res) => {
        setSettings(res);
        setSupportEmail(String(res.data.supportEmail || ""));
        setTrialDays(Number(res.data.trialDays || 14));
      })
      .catch(() => setLoadError("Could not load settings."));
  }, []);

  if (!can("tenants:read")) {
    return <ForbiddenPage />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!settings || !can("tenants:write")) return;
    setMessage("");
    try {
      const updated = await api<SettingsPayload>("/settings", {
        method: "PATCH",
        body: JSON.stringify({ version: settings.version, data: { supportEmail, trialDays } }),
      });
      setSettings(updated);
      setMessage("Settings saved.");
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not save.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Platform settings" description="Defaults for new tenants and support contact" />
      {loadError ? <p className="text-sm text-rose-500">{loadError}</p> : null}
      <PanelCard>
        <form onSubmit={onSubmit} className="mx-auto max-w-md space-y-4">
          <label className="block text-sm">
            Support email
            <input
              className="input mt-1"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              disabled={!can("tenants:write")}
            />
          </label>
          <label className="block text-sm">
            Default trial days
            <input
              type="number"
              className="input mt-1"
              value={trialDays}
              onChange={(e) => setTrialDays(Number(e.target.value))}
              min={0}
              max={90}
              disabled={!can("tenants:write")}
            />
          </label>
          {!can("tenants:write") ? (
            <p className="text-xs text-slate-500">Read-only for your role.</p>
          ) : null}
          {message ? <p className="text-sm text-accent-600">{message}</p> : null}
          {can("tenants:write") ? (
            <button type="submit" className="btn-primary" disabled={!settings}>Save changes</button>
          ) : null}
        </form>
      </PanelCard>
    </div>
  );
}
