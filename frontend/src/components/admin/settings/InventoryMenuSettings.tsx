"use client";

import Link from "next/link";
import { Package } from "lucide-react";
import { SettingsSection } from "@/components/admin/SettingsSection";
import type { StoreSettings } from "@/lib/types";

type Props = {
  settings: StoreSettings;
  onChange: (patch: Partial<StoreSettings>) => void;
};

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 dark:border-stone-600 dark:bg-stone-800/50">
      <div>
        <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-stone-500 dark:text-stone-400">{description}</p>
      </div>
      <input
        type="checkbox"
        className="mt-1 h-5 w-5 shrink-0 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export function InventoryMenuSettings({ settings, onChange }: Props) {
  return (
    <SettingsSection
      icon={Package}
      title="Inventory and menu"
      description="How stock levels affect online ordering and kitchen deductions."
    >
      <p className="text-xs text-stone-600">
        Manage ingredients and stock in{" "}
        <Link href="/admin/inventory" className="font-semibold text-brand-700 hover:text-brand-800">
          Inventory
        </Link>
        . These toggles apply store-wide.
      </p>

      <div className="space-y-3">
        <ToggleRow
          title="Auto-hide menu items"
          description="When enabled, dishes hide on the storefront if a required ingredient is out of stock."
          checked={settings.inventoryAutoHideMenu ?? false}
          onChange={(v) => onChange({ inventoryAutoHideMenu: v })}
        />
        <ToggleRow
          title="Deduct stock when preparing"
          description="Default on. Inventory decreases when an order moves to Preparing (not when the order is placed)."
          checked={settings.inventoryDeductAtPreparing ?? true}
          onChange={(v) => onChange({ inventoryDeductAtPreparing: v })}
        />
        <ToggleRow
          title="Allow negative stock"
          description="Lets adjustments go below zero. Use only if you track stock loosely; reports may show negative balances."
          checked={settings.inventoryAllowNegative ?? false}
          onChange={(v) => onChange({ inventoryAllowNegative: v })}
        />
      </div>
    </SettingsSection>
  );
}
