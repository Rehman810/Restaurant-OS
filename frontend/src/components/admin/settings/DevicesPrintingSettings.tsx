"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import { SettingsField, SettingsSection } from "@/components/admin/SettingsSection";
import type { StoreSettings } from "@/lib/types";
import { settingsPath } from "@/modules/settings/ia";

type Props = {
  settings: StoreSettings;
  onChange: (patch: Partial<StoreSettings>) => void;
  fieldErrors: Record<string, string>;
};

export function DevicesPrintingSettings({ settings, onChange, fieldErrors }: Props) {
  return (
    <SettingsSection
      icon={Printer}
      title="Devices and printing"
      description="Offline POS, device clock checks, kitchen printing, and customer order updates."
    >
      <p className="text-xs text-stone-600">
        VAPID keys and server push status are under{" "}
        <Link href={settingsPath("integrations")} className="font-semibold text-brand-700 hover:underline">
          Integrations
        </Link>
        .
      </p>

      <label className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-stone-300 text-brand-600"
          checked={Boolean(settings.storefrontPushEnabled)}
          onChange={(e) => onChange({ storefrontPushEnabled: e.target.checked })}
        />
        <span>
          <span className="block text-sm font-semibold text-stone-900">Order status push (PWA)</span>
          <span className="text-xs text-stone-500">
            Lets customers opt in on the order tracking page. Requires VAPID keys on the API server.
          </span>
        </span>
      </label>

      <label
        className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
          settings.offlinePosEnabled !== false
            ? "border-amber-300 bg-amber-50"
            : "border-stone-200 bg-stone-50"
        }`}
      >
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-stone-300 text-brand-600"
          checked={settings.offlinePosEnabled !== false}
          onChange={(e) => onChange({ offlinePosEnabled: e.target.checked })}
        />
        <div>
          <p className="text-sm font-semibold text-stone-900">Offline POS</p>
          <p className="mt-1 text-xs leading-relaxed text-stone-600">
            Allow cashiers to queue dine-in and takeaway orders when the internet drops. Sync requires connectivity.
          </p>
        </div>
      </label>

      <SettingsField
        label="Offline clock skew alert (minutes)"
        hint="Orders synced from devices whose clock differs from the server by more than this are flagged for review."
        error={fieldErrors.offlineClockSkewThresholdMinutes}
      >
        <input
          type="number"
          min={1}
          max={1440}
          className="input w-full max-w-md"
          value={settings.offlineClockSkewThresholdMinutes ?? 10}
          onChange={(e) =>
            onChange({
              offlineClockSkewThresholdMinutes: Number(e.target.value) || 10,
            })
          }
        />
      </SettingsField>

      <label
        className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
          settings.autoPrintKitchenTickets
            ? "border-sky-300 bg-sky-50"
            : "border-stone-200 bg-stone-50"
        }`}
      >
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-stone-300 text-brand-600"
          checked={settings.autoPrintKitchenTickets ?? false}
          onChange={(e) => onChange({ autoPrintKitchenTickets: e.target.checked })}
        />
        <div>
          <p className="text-sm font-semibold text-stone-900">Auto-print kitchen tickets</p>
          <p className="mt-1 text-xs leading-relaxed text-stone-600">
            When enabled, the kitchen board opens a browser print dialog for each new confirmed order (allow pop-ups).
            Tickets split by print station.
          </p>
        </div>
      </label>
    </SettingsSection>
  );
}
