"use client";

import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";
import { SettingsField, SettingsSection } from "@/components/admin/SettingsSection";
import { SettingsSelect } from "@/components/admin/settings/SettingsSelect";
import { SettingsFormGrid } from "@/components/admin/settings/SettingsFormGrid";
import type { StoreSettings } from "@/lib/types";

type Props = {
  settings: StoreSettings;
  onChange: (patch: Partial<StoreSettings>) => void;
  fieldErrors: Record<string, string>;
};

export function CostingSettings({ settings, onChange, fieldErrors }: Props) {
  const target = Number(settings.foodCostTargetPercent ?? 32);
  const high = Number(settings.foodCostHighPercent ?? 40);

  return (
    <SettingsSection
      icon={UtensilsCrossed}
      title="Costing"
      description="Targets for dish costing, menu engineering, and margin alerts."
    >
      <p className="text-xs text-stone-600">
        See live food cost on{" "}
        <Link href="/admin/reports/dish-costing" className="font-semibold text-brand-700 hover:text-brand-800">
          Dish costing report
        </Link>
        .
      </p>

      <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-xs text-stone-700">
        <p className="font-semibold text-stone-900">How bands work</p>
        <p className="mt-1">
          At or below <strong>{target}%</strong> food cost → on target. Between target and{" "}
          <strong>{high}%</strong> → watch. Above <strong>{high}%</strong> → high.
        </p>
      </div>

      <SettingsFormGrid>
      <SettingsField label="Target food cost %" hint="Default 32." error={fieldErrors.foodCostTargetPercent}>
        <input
          className="input w-full"
          type="number"
          min={0}
          max={100}
          step={0.5}
          value={settings.foodCostTargetPercent ?? 32}
          onChange={(e) => onChange({ foodCostTargetPercent: e.target.value })}
        />
      </SettingsField>
      <SettingsField
        label="High food cost %"
        hint="Must be at or above target. Default 40."
        error={fieldErrors.foodCostHighPercent}
      >
        <input
          className="input w-full"
          type="number"
          min={0}
          max={100}
          step={0.5}
          value={settings.foodCostHighPercent ?? 40}
          onChange={(e) => onChange({ foodCostHighPercent: e.target.value })}
        />
      </SettingsField>
      <SettingsField label="Suggested price rounding" hint="Round suggested prices up (1, 5, or 10)." error={fieldErrors.suggestedPriceRoundingStep}>
        <SettingsSelect
          aria-label="Suggested price rounding"
          value={String(settings.suggestedPriceRoundingStep ?? 10)}
          onChange={(v) => onChange({ suggestedPriceRoundingStep: Number(v) })}
          options={[
            { value: "1", label: "1" },
            { value: "5", label: "5" },
            { value: "10", label: "10" },
          ]}
        />
      </SettingsField>
      <SettingsField
        label="Suspicious low cost fraction"
        hint="Flag dishes below this fraction of the category median cost (0.01–1)."
        error={fieldErrors.suspiciousLowCostFraction}
      >
        <input
          className="input w-full"
          type="number"
          min={0.01}
          max={1}
          step={0.05}
          value={settings.suspiciousLowCostFraction ?? 0.25}
          onChange={(e) => onChange({ suspiciousLowCostFraction: e.target.value })}
        />
      </SettingsField>
      <SettingsField
        label="Ingredient price change alert %"
        hint="Staff alerts when purchase price jumps by at least this percent."
        error={fieldErrors.ingredientPriceChangeAlertPercent}
      >
        <input
          className="input w-full"
          type="number"
          min={1}
          max={100}
          value={settings.ingredientPriceChangeAlertPercent ?? 10}
          onChange={(e) => onChange({ ingredientPriceChangeAlertPercent: e.target.value })}
        />
      </SettingsField>
      </SettingsFormGrid>
    </SettingsSection>
  );
}
