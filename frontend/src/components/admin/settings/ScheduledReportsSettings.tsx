"use client";

import { Mail } from "lucide-react";
import { SettingsField, SettingsSection } from "@/components/admin/SettingsSection";
import { SettingsFormGrid } from "@/components/admin/settings/SettingsFormGrid";
import { SettingsSelect } from "@/components/admin/settings/SettingsSelect";
import { api, ApiError } from "@/lib/api";
import type { StoreSettings } from "@/lib/types";

type Props = {
  settings: StoreSettings;
  onChange: (patch: Partial<StoreSettings>) => void;
  testing: boolean;
  onTestingChange: (v: boolean) => void;
  onMessage: (msg: string) => void;
};

export function ScheduledReportsSettings({
  settings,
  onChange,
  testing,
  onTestingChange,
  onMessage,
}: Props) {
  return (
    <SettingsSection
      icon={Mail}
      title="Scheduled reports"
      description="Analytics summary emails and insight thresholds."
    >
      <SettingsFormGrid>
        <SettingsField label="Week starts on (0=Sun, 1=Mon)">
          <input
            type="number"
            min={0}
            max={6}
            className="input w-full"
            value={settings.weekStartDay ?? 1}
            onChange={(e) => onChange({ weekStartDay: Number(e.target.value) || 1 })}
          />
        </SettingsField>
        <SettingsField label="Insight minimum days">
          <input
            type="number"
            min={1}
            className="input w-full"
            value={settings.analyticsInsightMinDays ?? 7}
            onChange={(e) => onChange({ analyticsInsightMinDays: Number(e.target.value) || 7 })}
          />
        </SettingsField>
        <SettingsField label="Insight minimum orders">
          <input
            type="number"
            min={1}
            className="input w-full"
            value={settings.analyticsInsightMinOrders ?? 20}
            onChange={(e) => onChange({ analyticsInsightMinOrders: Number(e.target.value) || 20 })}
          />
        </SettingsField>
        <SettingsField label="Send hour (store timezone, 0–23)">
          <input
            type="number"
            min={0}
            max={23}
            className="input w-full"
            value={settings.analyticsEmailSendHour ?? 8}
            onChange={(e) => onChange({ analyticsEmailSendHour: Number(e.target.value) || 8 })}
          />
        </SettingsField>
        <SettingsField label="Email frequency">
          <SettingsSelect
            aria-label="Email frequency"
            value={settings.analyticsEmailFrequency ?? "weekly"}
            onChange={(v) => onChange({ analyticsEmailFrequency: v })}
            options={[
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly" },
            ]}
          />
        </SettingsField>
      </SettingsFormGrid>

      <SettingsField label="Scheduled analytics email">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(settings.analyticsEmailEnabled)}
            onChange={(e) => onChange({ analyticsEmailEnabled: e.target.checked })}
          />
          Send summary email (daily or weekly)
        </label>
      </SettingsField>

      <SettingsField label="Email recipients (comma-separated)">
        <input
          className="input w-full"
          value={settings.analyticsEmailRecipients ?? ""}
          onChange={(e) => onChange({ analyticsEmailRecipients: e.target.value })}
        />
      </SettingsField>

      <SettingsField label="Test analytics email">
        <p className="mb-2 text-xs text-stone-500">Applies immediately using saved report settings.</p>
        <button
          type="button"
          className="btn-secondary inline-flex items-center gap-2"
          disabled={testing}
          onClick={async () => {
            onTestingChange(true);
            onMessage("");
            try {
              await api("/admin/analytics/email/test", { method: "POST" });
              onMessage("Analytics summary email job triggered. Check recipient inbox if SMTP is configured.");
            } catch (e) {
              onMessage(e instanceof ApiError ? e.message : "Could not send test email");
            } finally {
              onTestingChange(false);
            }
          }}
        >
          {testing ? "Sending…" : "Send test email now"}
        </button>
      </SettingsField>
    </SettingsSection>
  );
}
