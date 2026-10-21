"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Plug, XCircle } from "lucide-react";
import { SettingsField, SettingsSection } from "@/components/admin/SettingsSection";
import { api } from "@/lib/api";
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
  }, []);

  const googleOk = status?.find((i) => i.id === "google-places")?.configured;
  const placeIdSet = Boolean(settings.googlePlaceId?.trim());

  return (
    <SettingsSection
      icon={Plug}
      title="Integrations"
      description="Server credentials live in backend/.env. This page shows status and store-specific IDs you can save here."
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
        See <code className="rounded bg-stone-100 px-1">backend/.env.example</code> for WhatsApp templates, SMTP, and
        VAPID setup. Restart the API after changing environment variables.
      </p>
    </SettingsSection>
  );
}
