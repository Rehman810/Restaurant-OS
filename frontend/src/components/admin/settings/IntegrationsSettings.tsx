"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Mail, Plug, XCircle } from "lucide-react";
import { SettingsField, SettingsSection } from "@/components/admin/SettingsSection";
import { api, ApiError } from "@/lib/api";
import type { StoreSettings } from "@/lib/types";

type IntegrationStatusItem = {
  id: string;
  label: string;
  configured: boolean;
  detail: string;
  envVars: string[];
};

type Props = {
  settings: StoreSettings;
  onChange: (patch: Partial<StoreSettings>) => void;
  fieldErrors: Record<string, string>;
};

export function IntegrationsSettings({ settings, onChange, fieldErrors }: Props) {
  const [status, setStatus] = useState<IntegrationStatusItem[] | null>(null);
  const [statusError, setStatusError] = useState("");
  const [testTo, setTestTo] = useState("");
  const [testMsg, setTestMsg] = useState("");
  const [testBusy, setTestBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api<{ items: IntegrationStatusItem[] }>("/settings/integrations/status")
      .then((data) => {
        if (!cancelled) setStatus(data.items);
      })
      .catch(() => {
        if (!cancelled) setStatusError("Could not load server integration status.");
      });
    return () => {
      cancelled = true;
    };
  }, [settings.smtpUseCustom, settings.smtpUser, settings.smtpPassConfigured]);

  const googleOk = status?.find((i) => i.id === "google-places")?.configured;
  const placeIdSet = Boolean(settings.googlePlaceId?.trim());
  const smtpItem = status?.find((i) => i.id === "smtp");
  const useGmail = (settings.smtpService || "").toLowerCase() === "gmail";

  async function sendSmtpTest(e: FormEvent) {
    e.preventDefault();
    setTestMsg("");
    setTestBusy(true);
    try {
      const res = await api<{ ok: boolean; to: string }>("/settings/integrations/smtp-test", {
        method: "POST",
        body: JSON.stringify({ to: testTo.trim() || undefined }),
      });
      setTestMsg(`Test email sent to ${res.to}.`);
    } catch (err) {
      setTestMsg(err instanceof ApiError ? err.message : "Test send failed.");
    } finally {
      setTestBusy(false);
    }
  }

  return (
    <SettingsSection
      icon={Plug}
      title="Integrations"
      description="Connect email, reviews, and server-backed services for this restaurant."
    >
      <p className="text-xs text-stone-600">
        Email notifications are configured in{" "}
        <Link href="/admin/settings/notifications" className="font-semibold text-brand-700 hover:text-brand-800">
          Notifications
        </Link>
        . Customer order push is under{" "}
        <Link href="/admin/settings/devices-printing" className="font-semibold text-brand-700 hover:text-brand-800">
          Devices and printing
        </Link>
        .
      </p>

      {statusError && <p className="text-xs text-rose-700">{statusError}</p>}

      <ul className="grid gap-3 sm:grid-cols-2">
        {(status ?? []).map((item) => (
          <li
            key={item.id}
            className={`rounded-2xl border p-4 ${
              item.configured ? "border-emerald-200 bg-emerald-50/50" : "border-stone-200 bg-stone-50"
            }`}
          >
            <div className="flex items-start gap-2">
              {item.configured ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" aria-hidden />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-stone-900">{item.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-stone-600">{item.detail}</p>
                <p className="mt-2 font-mono text-[10px] text-stone-500">{item.envVars.join(" · ")}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {!status && !statusError && <p className="text-xs text-stone-500">Loading server status…</p>}

      <div className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-600 dark:bg-stone-900/40">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-brand-600" aria-hidden />
          <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">Restaurant SMTP</p>
        </div>
        <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
          Send order and staff emails from your own mailbox (Gmail, Outlook, or custom host). When enabled, this overrides
          the server <code className="rounded bg-stone-100 px-1 dark:bg-stone-800">.env</code> SMTP for this tenant only.
        </p>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-stone-400"
            checked={Boolean(settings.smtpUseCustom)}
            onChange={(e) => onChange({ smtpUseCustom: e.target.checked })}
          />
          <span>Use custom SMTP for this restaurant</span>
        </label>

        {settings.smtpUseCustom ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <SettingsField label="Provider" error={fieldErrors.smtpService}>
              <select
                className="input"
                value={useGmail ? "gmail" : "custom"}
                onChange={(e) =>
                  onChange({
                    smtpService: e.target.value === "gmail" ? "gmail" : "",
                    smtpHost: e.target.value === "gmail" ? "" : settings.smtpHost,
                    smtpPort: e.target.value === "gmail" ? 587 : settings.smtpPort ?? 587,
                  })
                }
              >
                <option value="gmail">Gmail / Google Workspace</option>
                <option value="custom">Custom SMTP host</option>
              </select>
            </SettingsField>
            <SettingsField label="SMTP username (email)" error={fieldErrors.smtpUser}>
              <input
                className="input"
                type="email"
                autoComplete="off"
                value={settings.smtpUser ?? ""}
                onChange={(e) => onChange({ smtpUser: e.target.value })}
              />
            </SettingsField>
            {!useGmail ? (
              <SettingsField label="SMTP host" error={fieldErrors.smtpHost} className="sm:col-span-2">
                <input
                  className="input font-mono text-sm"
                  placeholder="smtp.example.com"
                  value={settings.smtpHost ?? ""}
                  onChange={(e) => onChange({ smtpHost: e.target.value })}
                />
              </SettingsField>
            ) : null}
            <SettingsField label="Port" error={fieldErrors.smtpPort}>
              <input
                className="input"
                type="number"
                min={1}
                max={65535}
                value={settings.smtpPort ?? 587}
                onChange={(e) => onChange({ smtpPort: Number(e.target.value) })}
              />
            </SettingsField>
            <label className="flex items-center gap-2 text-sm self-end pb-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-stone-400"
                checked={Boolean(settings.smtpSecure)}
                onChange={(e) => onChange({ smtpSecure: e.target.checked })}
              />
              <span>Use TLS/SSL (port 465)</span>
            </label>
            <SettingsField
              label="App password"
              hint={
                settings.smtpPassConfigured
                  ? "Leave blank to keep the saved password. Enter a new value to replace it."
                  : useGmail
                    ? "Use a 16-character Gmail App Password, not your login password."
                    : "SMTP password or app token."
              }
              error={fieldErrors.smtpPass}
              className="sm:col-span-2"
            >
              <input
                className="input font-mono text-sm"
                type="password"
                autoComplete="new-password"
                value={settings.smtpPass ?? ""}
                onChange={(e) => onChange({ smtpPass: e.target.value })}
              />
            </SettingsField>
            <SettingsField label="From address (optional)" hint="Defaults to SMTP username." error={fieldErrors.smtpFrom}>
              <input
                className="input text-sm"
                placeholder="orders@yourrestaurant.com"
                value={settings.smtpFrom ?? ""}
                onChange={(e) => onChange({ smtpFrom: e.target.value })}
              />
            </SettingsField>
            <SettingsField label="Reply-to (optional)" error={fieldErrors.smtpReplyTo}>
              <input
                className="input text-sm"
                placeholder="support@yourrestaurant.com"
                value={settings.smtpReplyTo ?? ""}
                onChange={(e) => onChange({ smtpReplyTo: e.target.value })}
              />
            </SettingsField>
          </div>
        ) : null}

        {smtpItem?.configured ? (
          <form onSubmit={sendSmtpTest} className="mt-4 flex flex-wrap items-end gap-2 border-t border-stone-100 pt-4 dark:border-stone-700">
            <label className="min-w-[200px] flex-1 text-sm">
              <span className="field-label">Send test email</span>
              <input
                className="input mt-1"
                type="email"
                placeholder="your@email.com"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
              />
            </label>
            <button type="submit" className="btn-secondary" disabled={testBusy}>
              {testBusy ? "Sending…" : "Test SMTP"}
            </button>
            {testMsg ? <p className="w-full text-xs text-stone-600">{testMsg}</p> : null}
            <p className="w-full text-[11px] text-stone-500">Save settings first if you just changed SMTP credentials.</p>
          </form>
        ) : null}
      </div>

      <SettingsField
        label="Google Place ID"
        hint="Powers live Google reviews on the homepage (with Places API key above). Find in Google Maps → Share → Embed a map."
        error={fieldErrors.googlePlaceId}
      >
        <input
          className="input font-mono text-sm"
          placeholder="ChIJ…"
          value={settings.googlePlaceId ?? ""}
          onChange={(e) => onChange({ googlePlaceId: e.target.value })}
        />
        {placeIdSet && !googleOk && (
          <p className="mt-1 text-xs text-amber-800">
            Place ID is saved but GOOGLE_PLACES_API_KEY is not set on the server — reviews will use fallback data.
          </p>
        )}
        {placeIdSet && googleOk && (
          <p className="mt-1 text-xs text-emerald-800">Ready to fetch live reviews after you save.</p>
        )}
      </SettingsField>

      <p className="text-[11px] text-stone-500">
        WhatsApp and web push still use server environment variables. See{" "}
        <code className="rounded bg-stone-100 px-1">backend/.env.example</code>.
      </p>
    </SettingsSection>
  );
}
