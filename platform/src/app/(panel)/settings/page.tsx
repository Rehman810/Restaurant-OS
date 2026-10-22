"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
  const [trialDays, setTrialDays] = useState(14);
  const [invoiceLegalName, setInvoiceLegalName] = useState("");
  const [invoiceNtn, setInvoiceNtn] = useState("");
  const [bankAccounts, setBankAccounts] = useState<BankRow[]>([{ label: "Bank transfer", account: "" }]);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    void api<SettingsPayload>("/settings")
      .then((res) => {
        setSettings(res);
        setSupportEmail(String(res.data.supportEmail || ""));
        setTrialDays(Number(res.data.trialDays || 14));
        setInvoiceLegalName(String(res.data.invoiceLegalName || ""));
        setInvoiceNtn(String(res.data.invoiceNtn || ""));
        const banks = parseBanks(res.data.bankAccounts);
        setBankAccounts(banks.length ? banks : [{ label: "Bank transfer", account: "" }]);
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
      <PageHeader eyebrow="Defaults" title="Platform settings" description="Tenant defaults, support contact, and payment details shown on billing" />
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
