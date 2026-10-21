"use client";

import { Gauge } from "lucide-react";
import { SettingsField, SettingsSection } from "@/components/admin/SettingsSection";
import { SettingsFormGrid } from "@/components/admin/settings/SettingsFormGrid";
import type { StoreSettings } from "@/lib/types";

type Props = {
  settings: StoreSettings;
  onChange: (patch: Partial<StoreSettings>) => void;
};

export function AlertThresholdsSettings({ settings, onChange }: Props) {
  return (
    <SettingsSection
      icon={Gauge}
      title="Alert thresholds"
      description="When orders and shifts show as late or stale on dashboards."
    >
      <SettingsFormGrid>
        <SettingsField label="Late confirmation (minutes)">
          <input
            type="number"
            min={1}
            className="input w-full"
            value={settings.lateConfirmMinutes ?? 15}
            onChange={(e) => onChange({ lateConfirmMinutes: Number(e.target.value) || 15 })}
          />
        </SettingsField>
        <SettingsField label="Late prep / ready (minutes)">
          <input
            type="number"
            min={1}
            className="input w-full"
            value={settings.latePrepMinutes ?? 30}
            onChange={(e) => onChange({ latePrepMinutes: Number(e.target.value) || 30 })}
          />
        </SettingsField>
        <SettingsField label="Late delivery (minutes)">
          <input
            type="number"
            min={1}
            className="input w-full"
            value={settings.lateDeliveryMinutes ?? 45}
            onChange={(e) => onChange({ lateDeliveryMinutes: Number(e.target.value) || 45 })}
          />
        </SettingsField>
        <SettingsField
          label="Stale order threshold (hours)"
          hint="Live board flags orders in the same pipeline status longer than this."
        >
          <input
            type="number"
            min={1}
            className="input w-full"
            value={settings.ordersStaleHours ?? 2}
            onChange={(e) => onChange({ ordersStaleHours: Number(e.target.value) || 2 })}
          />
        </SettingsField>
        <SettingsField
          label="Duplicate order window (minutes)"
          hint="Board and dispatch list show a possible-duplicate hint within this window."
        >
          <input
            type="number"
            min={1}
            className="input w-full"
            value={settings.duplicateOrderWindowMinutes ?? 10}
            onChange={(e) =>
              onChange({ duplicateOrderWindowMinutes: Number(e.target.value) || 10 })
            }
          />
        </SettingsField>
        <SettingsField
          label="Completed column window (hours)"
          hint="0 = store calendar day only. Greater than 0 = rolling hours on the live board."
        >
          <input
            type="number"
            min={0}
            className="input w-full"
            value={settings.trackingCompletedWindowHours ?? 0}
            onChange={(e) =>
              onChange({
                trackingCompletedWindowHours: Math.max(0, Number(e.target.value) || 0),
              })
            }
          />
        </SettingsField>
        <SettingsField label="Shift open warning (hours)">
          <input
            type="number"
            min={1}
            className="input w-full"
            value={settings.shiftOpenWarningHours ?? 12}
            onChange={(e) => onChange({ shiftOpenWarningHours: Number(e.target.value) || 12 })}
          />
        </SettingsField>
        <SettingsField label="Low rating threshold (1–5)">
          <input
            type="number"
            min={1}
            max={5}
            className="input w-full"
            value={settings.lowRatingThreshold ?? 2}
            onChange={(e) => onChange({ lowRatingThreshold: Number(e.target.value) || 2 })}
          />
        </SettingsField>
      </SettingsFormGrid>
    </SettingsSection>
  );
}
