"use client";

import Link from "next/link";
import { Shield } from "lucide-react";
import { SettingsField, SettingsSection } from "@/components/admin/SettingsSection";
import type { StoreSettings } from "@/lib/types";
import { SettingsFormGrid } from "@/components/admin/settings/SettingsFormGrid";
import { ReasonListEditor } from "@/components/admin/settings/ReasonListEditor";
import { settingsPath } from "@/modules/settings/ia";

type Props = {
  settings: StoreSettings;
  onChange: (patch: Partial<StoreSettings>) => void;
  fieldErrors: Record<string, string>;
};

export function PosControlsApprovalsSettings({ settings, onChange, fieldErrors }: Props) {
  const approvalToggles = [
    ["requireApprovalForVoid", "Require manager approval to void orders"],
    ["requireApprovalForRefund", "Require manager approval for refunds"],
    ["requireApprovalForPriceOverride", "Require manager approval for price overrides"],
  ] as const;

  return (
    <SettingsSection
      icon={Shield}
      title="POS controls and approvals"
      description="Discount limits, when a manager PIN is required, and preset reasons staff choose at the POS."
    >
      <p className="text-xs text-stone-600">
        Each manager sets their own approval PIN under{" "}
        <Link href={settingsPath("my-account")} className="font-semibold text-brand-700 hover:underline">
          My account
        </Link>
        .
      </p>

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Discounts</p>
        <SettingsFormGrid columns={2}>
          <SettingsField
            label="Max cashier discount (%)"
            hint="Cashiers can discount up to this percent without a manager PIN."
            error={fieldErrors.maxCashierDiscountPercent}
          >
            <input
              type="number"
              min={0}
              max={100}
              className="input w-full"
              value={settings.maxCashierDiscountPercent ?? 10}
              onChange={(e) => onChange({ maxCashierDiscountPercent: e.target.value })}
            />
          </SettingsField>
        </SettingsFormGrid>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Manager approvals</p>
        <SettingsFormGrid columns={3}>
          {approvalToggles.map(([key, label]) => (
            <label
              key={key}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-3 dark:border-stone-600 dark:bg-stone-800/50"
            >
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5 shrink-0 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                checked={Boolean(settings[key])}
                onChange={(e) => onChange({ [key]: e.target.checked })}
              />
              <span className="text-sm font-medium leading-snug text-stone-900 dark:text-stone-100">{label}</span>
            </label>
          ))}
        </SettingsFormGrid>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Reason lists (POS dropdowns)</p>
        <SettingsFormGrid columns={3}>
          <ReasonListEditor
            label="Void reasons"
            hint="When voiding or cancelling an order."
            value={settings.voidReasonOptions ?? []}
            onChange={(lines) => onChange({ voidReasonOptions: lines })}
          />
          <ReasonListEditor
            label="Discount reasons"
            value={settings.discountReasonOptions ?? []}
            onChange={(lines) => onChange({ discountReasonOptions: lines })}
          />
          <ReasonListEditor
            label="Refund reasons"
            value={settings.refundReasonOptions ?? []}
            onChange={(lines) => onChange({ refundReasonOptions: lines })}
          />
        </SettingsFormGrid>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Cash and shifts</p>
        <SettingsFormGrid columns={2}>
          <SettingsField
            label="Shift variance tolerance (Rs)"
            hint="Closing variance above this amount requires a manager note."
            error={fieldErrors.shiftVarianceTolerance}
          >
            <input
              type="number"
              min={0}
              className="input w-full"
              value={settings.shiftVarianceTolerance ?? 500}
              onChange={(e) => onChange({ shiftVarianceTolerance: e.target.value })}
            />
          </SettingsField>
          <SettingsField
            label="Rider cash stale alert (hours)"
            hint="Dashboard flags pending COD older than this many hours."
            error={fieldErrors.riderCashStaleHours}
          >
            <input
              type="number"
              min={1}
              max={336}
              className="input w-full"
              value={settings.riderCashStaleHours ?? 24}
              onChange={(e) => onChange({ riderCashStaleHours: Number(e.target.value) || 24 })}
            />
          </SettingsField>
        </SettingsFormGrid>
      </div>
    </SettingsSection>
  );
}
