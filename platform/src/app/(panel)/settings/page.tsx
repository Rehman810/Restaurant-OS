"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { PlatformTwoFactorSettings } from "@/components/PlatformTwoFactorSettings";
import { api, ApiError } from "@/lib/api";
import { usePlatformAuth } from "@/lib/auth";
import { ForbiddenPage } from "@/components/RequirePermission";
import { PageHeader } from "@/components/PageHeader";
import { PanelCard } from "@/components/PanelCard";

type SettingsPayload = {
  version: number;
  data: Record<string, unknown>;
};

type BankRow = { label: string; account: string };

type StatusIncident = { id: string; title: string; status: string; updatedAt: string; body?: string };

function parseBanks(raw: unknown): BankRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const o = row as Record<string, unknown>;
      return { label: String(o.label || ""), account: String(o.account || "") };
    })
    .filter((r) => r.label.trim() || r.account.trim());
}

export default function SettingsPage() {
  const { can } = usePlatformAuth();
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [supportEmail, setSupportEmail] = useState("");
  const [trialDays, setTrialDays] = useState(15);
  const [invoiceLegalName, setInvoiceLegalName] = useState("");
  const [invoiceNtn, setInvoiceNtn] = useState("");
  const [bankAccounts, setBankAccounts] = useState<BankRow[]>([{ label: "Bank transfer", account: "" }]);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [require2FA, setRequire2FA] = useState(false);
  const [dunningEnabled, setDunningEnabled] = useState(false);
  const [dunningOffsets, setDunningOffsets] = useState("-3,0,3,7");
  const [overdueTemplate, setOverdueTemplate] = useState("");
  const [statusHeadline, setStatusHeadline] = useState("All systems operational");
  const [statusIncidents, setStatusIncidents] = useState<StatusIncident[]>([]);

  useEffect(() => {
    void api<SettingsPayload>("/settings")
      .then((res) => {
        setSettings(res);
        setSupportEmail(String(res.data.supportEmail || ""));
        setTrialDays(Number(res.data.trialDays ?? 15));
        setInvoiceLegalName(String(res.data.invoiceLegalName || ""));
        setInvoiceNtn(String(res.data.invoiceNtn || ""));
        const banks = parseBanks(res.data.bankAccounts);
        setBankAccounts(banks.length ? banks : [{ label: "Bank transfer", account: "" }]);
        setRequire2FA(Boolean(res.data.require2FAForAllPlatformUsers));
        const d = res.data.dunning as { enabled?: boolean; reminderOffsetsDays?: number[] } | undefined;
        setDunningEnabled(Boolean(d?.enabled));
        if (d?.reminderOffsetsDays?.length) setDunningOffsets(d.reminderOffsetsDays.join(","));
        const tpl = res.data.dunningEmailTemplates as { paymentOverdue?: string } | undefined;
        setOverdueTemplate(tpl?.paymentOverdue || "");
        const sp = res.data.statusPage as { headline?: string; incidents?: StatusIncident[] } | undefined;
        setStatusHeadline(sp?.headline || "All systems operational");
        setStatusIncidents(Array.isArray(sp?.incidents) ? sp!.incidents! : []);
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
    const banks = bankAccounts
      .map((b) => ({ label: b.label.trim(), account: b.account.trim() }))
      .filter((b) => b.label && b.account);
    try {
      const updated = await api<SettingsPayload>("/settings", {
        method: "PATCH",
        body: JSON.stringify({
          version: settings.version,
          data: {
            supportEmail,
            trialDays,
            invoiceLegalName,
            invoiceNtn,
            bankAccounts: banks,
            ...(can("security:write") ? { require2FAForAllPlatformUsers: require2FA } : {}),
            ...(can("tenants:write")
              ? {
                  dunning: {
                    enabled: dunningEnabled,
                    reminderOffsetsDays: dunningOffsets
                      .split(",")
                      .map((s) => Number(s.trim()))
                      .filter((n) => Number.isFinite(n)),
                  },
                  dunningEmailTemplates: { paymentOverdue: overdueTemplate || undefined },
                  statusPage: {
                    headline: statusHeadline.trim() || "All systems operational",
                    incidents: statusIncidents.map((inc) => ({
                      ...inc,
                      updatedAt: inc.updatedAt || new Date().toISOString(),
                    })),
                  },
                }
              : {}),
          },
        }),
      });
      setSettings(updated);
      setMessage("Settings saved. Tenants see support and bank details on Plan and billing.");
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not save.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Defaults" title="Platform settings" description="Tenant defaults, support contact, and payment details shown on billing">
        {can("platform_users:read") ? (
          <Link href="/settings/team" className="btn-secondary">Team</Link>
        ) : null}
        {can("security:write") ? (
          <Link href="/settings/alerts" className="btn-secondary">Alerts</Link>
        ) : null}
        <Link href="/status" className="btn-secondary" target="_blank" rel="noopener noreferrer">Status page</Link>
      </PageHeader>
      <PlatformTwoFactorSettings />
      {loadError ? <p className="flash-error">{loadError}</p> : null}
      <PanelCard>
        <form onSubmit={onSubmit} className="mx-auto max-w-lg space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Onboarding</h3>
            <label className="block text-sm">
              <span className="field-label">Default trial days</span>
              <input
                type="number"
                className="input"
                value={trialDays}
                onChange={(e) => setTrialDays(Number(e.target.value))}
                min={0}
                max={90}
                disabled={!can("tenants:write")}
              />
            </label>
          </div>
          <div className="space-y-4 border-t border-slate-200 pt-4 dark:border-white/10">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Tenant billing page</h3>
            <label className="block text-sm">
              <span className="field-label">Support email</span>
              <input
                className="input"
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                disabled={!can("tenants:write")}
              />
            </label>
            <label className="block text-sm">
              <span className="field-label">Legal name on invoices</span>
              <input
                className="input"
                value={invoiceLegalName}
                onChange={(e) => setInvoiceLegalName(e.target.value)}
                placeholder="Restaurant OS (Pvt) Ltd"
                disabled={!can("tenants:write")}
              />
            </label>
            <label className="block text-sm">
              <span className="field-label">NTN (optional)</span>
              <input
                className="input"
                value={invoiceNtn}
                onChange={(e) => setInvoiceNtn(e.target.value)}
                disabled={!can("tenants:write")}
              />
            </label>
            <div>
              <p className="field-label">Bank / JazzCash / Easypaisa accounts</p>
              <ul className="mt-2 space-y-3">
                {bankAccounts.map((row, i) => (
                  <li key={i} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 dark:border-white/10 sm:flex-row sm:items-start">
                    <input
                      className="input sm:max-w-[10rem]"
                      placeholder="Label"
                      value={row.label}
                      onChange={(e) => {
                        const next = [...bankAccounts];
                        next[i] = { ...next[i], label: e.target.value };
                        setBankAccounts(next);
                      }}
                      disabled={!can("tenants:write")}
                    />
                    <input
                      className="input flex-1 font-mono text-xs"
                      placeholder="Account / IBAN / number"
                      value={row.account}
                      onChange={(e) => {
                        const next = [...bankAccounts];
                        next[i] = { ...next[i], account: e.target.value };
                        setBankAccounts(next);
                      }}
                      disabled={!can("tenants:write")}
                    />
                    {can("tenants:write") && bankAccounts.length > 1 ? (
                      <button
                        type="button"
                        className="btn-ghost h-10 shrink-0 px-2 text-rose-500"
                        aria-label="Remove account"
                        onClick={() => setBankAccounts(bankAccounts.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
              {can("tenants:write") ? (
                <button
                  type="button"
                  className="btn-secondary mt-2"
                  onClick={() => setBankAccounts([...bankAccounts, { label: "", account: "" }])}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Add account
                </button>
              ) : null}
            </div>
          </div>
          {can("tenants:write") ? (
            <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-white/10">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Public status page</h3>
              <label className="block text-sm">
                <span className="field-label">Headline (when not in maintenance)</span>
                <input className="input" value={statusHeadline} onChange={(e) => setStatusHeadline(e.target.value)} />
              </label>
              <div>
                <p className="field-label">Incidents</p>
                <ul className="mt-2 space-y-3">
                  {statusIncidents.map((inc, i) => (
                    <li key={inc.id} className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
                      <input
                        className="input mb-2"
                        placeholder="Title"
                        value={inc.title}
                        onChange={(e) => {
                          const next = [...statusIncidents];
                          next[i] = { ...inc, title: e.target.value };
                          setStatusIncidents(next);
                        }}
                      />
                      <input
                        className="input mb-2"
                        placeholder="Status (investigating, resolved, …)"
                        value={inc.status}
                        onChange={(e) => {
                          const next = [...statusIncidents];
                          next[i] = { ...inc, status: e.target.value, updatedAt: new Date().toISOString() };
                          setStatusIncidents(next);
                        }}
                      />
                      <textarea
                        className="input min-h-16 text-xs"
                        placeholder="Details (optional)"
                        value={inc.body || ""}
                        onChange={(e) => {
                          const next = [...statusIncidents];
                          next[i] = { ...inc, body: e.target.value };
                          setStatusIncidents(next);
                        }}
                      />
                      <button
                        type="button"
                        className="btn-ghost mt-2 text-xs text-rose-500"
                        onClick={() => setStatusIncidents(statusIncidents.filter((_, j) => j !== i))}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="btn-secondary mt-2"
                  onClick={() =>
                    setStatusIncidents([
                      ...statusIncidents,
                      {
                        id: crypto.randomUUID(),
                        title: "",
                        status: "investigating",
                        updatedAt: new Date().toISOString(),
                      },
                    ])
                  }
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Add incident
                </button>
              </div>
            </div>
          ) : null}
          {can("tenants:write") ? (
            <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-white/10">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Dunning (email)</h3>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 rounded" checked={dunningEnabled} onChange={(e) => setDunningEnabled(e.target.checked)} />
                <span>Send automatic payment reminders</span>
              </label>
              <label className="block text-sm">
                <span className="field-label">Reminder days (relative to due date, comma-separated)</span>
                <input className="input font-mono text-xs" value={dunningOffsets} onChange={(e) => setDunningOffsets(e.target.value)} />
                <span className="mt-1 block text-xs text-slate-500">Default: -3,0,3,7 (before due, due day, +3 and +7 overdue)</span>
              </label>
              <label className="block text-sm">
                <span className="field-label">Overdue email template</span>
                <textarea
                  className="input min-h-[80px] font-mono text-xs"
                  value={overdueTemplate}
                  onChange={(e) => setOverdueTemplate(e.target.value)}
                  placeholder="Variables: {{tenantName}}, {{invoiceNumber}}, {{amountPkr}}, {{dueAt}}, ..."
                />
              </label>
            </div>
          ) : null}
          {can("security:write") ? (
            <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-white/10">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Security</h3>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-400"
                  checked={require2FA}
                  onChange={(e) => setRequire2FA(e.target.checked)}
                />
                <span>Require two-factor authentication for all platform users</span>
              </label>
            </div>
          ) : null}
          {!can("tenants:write") ? (
            <p className="text-xs text-slate-500">Read-only for your role.</p>
          ) : null}
          {message ? <p className="text-sm text-accent-400">{message}</p> : null}
          {can("tenants:write") ? (
            <button type="submit" className="btn-primary" disabled={!settings}>Save changes</button>
          ) : null}
        </form>
      </PanelCard>
    </div>
  );
}
