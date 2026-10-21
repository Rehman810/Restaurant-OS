"use client";

import { useMemo } from "react";
import { SettingsField, SettingsSection } from "@/components/admin/SettingsSection";
import { SettingsSelect } from "@/components/admin/settings/SettingsSelect";
import { quoteCharges } from "@/lib/charges";
import {
  FULFILLMENT_KEYS,
  PAYMENT_KEYS,
  parseTaxRateMap,
  resolveTaxRatePercent,
  setTaxRateOverride,
  TAX_ROUNDING_OPTIONS,
} from "@/lib/tax-settings";
import type { StoreSettings } from "@/lib/types";
import { Receipt } from "lucide-react";

const FULFILLMENT_LABELS: Record<string, string> = {
  DELIVERY: "Delivery",
  PICKUP: "Pickup",
  DINE_IN: "Dine-in",
};

type Props = {
  settings: StoreSettings;
  onChange: (patch: Partial<StoreSettings>) => void;
  fieldErrors: Record<string, string>;
};

export function TaxReceiptsSettings({ settings, onChange, fieldErrors }: Props) {
  const symbol = settings.currencySymbol ?? "Rs";
  const byFulfillment = parseTaxRateMap(settings.taxRatesByFulfillment);
  const byPayment = parseTaxRateMap(settings.taxRatesByPayment);

  const preview = useMemo(() => {
    const subtotal = 1000;
    const delivery = 0;
    const storefront = quoteCharges(subtotal, delivery, settings);
    const invoiceRate = settings.taxEnabled
      ? resolveTaxRatePercent(settings, { fulfillmentType: "DELIVERY", paymentMethod: "CASH" })
      : Number(settings.taxPercent ?? 0);
    const inclusive = settings.taxEnabled
      ? Boolean(settings.pricesIncludeTax ?? settings.taxIncluded)
      : Boolean(settings.taxIncluded);
    return { storefront, invoiceRate, inclusive };
  }, [settings]);

  return (
    <SettingsSection
      icon={Receipt}
      title="Tax and receipts"
      description="Checkout charges, optional tax invoicing, and what prints on receipts."
    >
      <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Checkout preview</p>
        <p className="mt-1 text-sm text-stone-800">
          On a {symbol} 1,000 subtotal:{" "}
          <span className="font-semibold">
            {settings.taxLabel || "Tax"}{" "}
            {preview.storefront.tax > 0
              ? `${symbol} ${preview.storefront.tax.toFixed(2)}${settings.taxIncluded ? " (in menu)" : ""}`
              : "none"}
          </span>
          {Number(settings.serviceChargePercent) > 0 && (
            <>
              {" · "}
              <span className="font-semibold">
                {settings.serviceChargeLabel || "Service"}{" "}
                {symbol} {preview.storefront.service.toFixed(2)}
                {settings.serviceIncluded ? " (in menu)" : ""}
              </span>
            </>
          )}
          {" · "}
          <span className="font-semibold">Total {symbol} {preview.storefront.total.toFixed(2)}</span>
        </p>
        {settings.taxEnabled && (
          <p className="mt-1 text-xs text-stone-600">
            Invoicing uses {preview.invoiceRate}% for delivery + cash
            {preview.inclusive ? " (tax extracted from menu prices)" : " (tax added to taxable amount)"}.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-stone-900">Storefront charges</p>
        <p className="text-xs text-stone-500">Shown in cart and checkout before tax invoicing snapshots.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsField label={settings.taxLabel || "Tax"} hint="Percent. Leave 0 to hide at checkout.">
          <input
            className="input"
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={settings.taxPercent ?? 0}
            onChange={(e) => onChange({ taxPercent: e.target.value })}
          />
        </SettingsField>
        <SettingsField label="Tax label">
          <input
            className="input"
            value={settings.taxLabel ?? "Tax"}
            onChange={(e) => onChange({ taxLabel: e.target.value })}
          />
        </SettingsField>
        <SettingsField label={settings.serviceChargeLabel || "Service charge"}>
          <input
            className="input"
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={settings.serviceChargePercent ?? 0}
            onChange={(e) => onChange({ serviceChargePercent: e.target.value })}
          />
        </SettingsField>
        <SettingsField label="Service label">
          <input
            className="input"
            value={settings.serviceChargeLabel ?? "Service charge"}
            onChange={(e) => onChange({ serviceChargeLabel: e.target.value })}
          />
        </SettingsField>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2 font-medium text-stone-700">
          <input
            type="checkbox"
            checked={Boolean(settings.taxIncluded)}
            onChange={(e) => onChange({ taxIncluded: e.target.checked })}
          />
          Tax included in menu prices (checkout)
        </label>
        <label className="flex items-center gap-2 font-medium text-stone-700">
          <input
            type="checkbox"
            checked={Boolean(settings.serviceIncluded)}
            onChange={(e) => onChange({ serviceIncluded: e.target.checked })}
          />
          Service included in menu prices
        </label>
      </div>

      <label className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4">
        <input
          type="checkbox"
          className="mt-1"
          checked={Boolean(settings.taxEnabled)}
          onChange={(e) => onChange({ taxEnabled: e.target.checked })}
        />
        <span>
          <span className="block text-sm font-semibold text-stone-900">Tax invoicing mode</span>
          <span className="text-xs text-stone-500">
            Snapshots tax on orders, issues TAX-* invoice numbers, and enables tax reports. See docs/TAX_INVOICING_NOTES.md.
          </span>
        </span>
      </label>

      {settings.taxEnabled && (
        <div className="space-y-4 rounded-2xl border border-brand-100 bg-brand-50/30 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingsField label="Legal business name">
              <input
                className="input"
                value={settings.taxLegalName ?? ""}
                onChange={(e) => onChange({ taxLegalName: e.target.value })}
              />
            </SettingsField>
            <SettingsField label="STRN">
              <input className="input" value={settings.taxStrn ?? ""} onChange={(e) => onChange({ taxStrn: e.target.value })} />
            </SettingsField>
            <SettingsField label="Business address" className="sm:col-span-2">
              <input
                className="input"
                value={settings.taxBusinessAddress ?? ""}
                onChange={(e) => onChange({ taxBusinessAddress: e.target.value })}
              />
            </SettingsField>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
            <input
              type="checkbox"
              checked={Boolean(settings.pricesIncludeTax ?? settings.taxIncluded)}
              onChange={(e) => onChange({ pricesIncludeTax: e.target.checked })}
            />
            Menu prices include tax (invoicing engine)
          </label>

          <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
            <input
              type="checkbox"
              checked={Boolean(settings.taxFiscalYearEnabled)}
              onChange={(e) => onChange({ taxFiscalYearEnabled: e.target.checked })}
            />
            Fiscal-year invoice sequence (vs daily)
          </label>

          <SettingsField label="Tax rounding" hint="Applied when computing invoice tax amounts.">
            <SettingsSelect
              aria-label="Tax rounding"
              value={settings.taxRoundingRule ?? "HALF_UP"}
              onChange={(v) => onChange({ taxRoundingRule: v })}
              options={TAX_ROUNDING_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
            />
          </SettingsField>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-stone-600">Rate overrides by fulfillment</p>
              <p className="mb-2 text-[11px] text-stone-500">Blank uses the default tax % above.</p>
              <div className="space-y-2">
                {FULFILLMENT_KEYS.map((key) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <span className="w-20 shrink-0 text-stone-600">{FULFILLMENT_LABELS[key]}</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      className="input w-24"
                      placeholder={String(settings.taxPercent ?? 0)}
                      value={byFulfillment[key] ?? ""}
                      onChange={(e) =>
                        onChange({
                          taxRatesByFulfillment: setTaxRateOverride(settings.taxRatesByFulfillment, key, e.target.value),
                        })
                      }
                    />
                    <span className="text-xs text-stone-400">%</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-stone-600">Rate overrides by payment</p>
              <p className="mb-2 text-[11px] text-stone-500">Payment wins over fulfillment when both are set.</p>
              <div className="space-y-2">
                {PAYMENT_KEYS.map((key) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <span className="w-20 shrink-0 text-stone-600">{key === "CASH" ? "Cash" : "Card"}</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      className="input w-24"
                      placeholder={String(settings.taxPercent ?? 0)}
                      value={byPayment[key] ?? ""}
                      onChange={(e) =>
                        onChange({
                          taxRatesByPayment: setTaxRateOverride(settings.taxRatesByPayment, key, e.target.value),
                        })
                      }
                    />
                    <span className="text-xs text-stone-400">%</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          {(fieldErrors.taxRatesByFulfillment || fieldErrors.taxRatesByPayment) && (
            <p className="text-xs text-rose-700">
              {fieldErrors.taxRatesByFulfillment || fieldErrors.taxRatesByPayment}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsField label="Tax registration (NTN)" hint="Optional. Printed on receipts.">
          <input className="input" value={settings.taxNumber ?? ""} onChange={(e) => onChange({ taxNumber: e.target.value })} />
        </SettingsField>
        <SettingsField label="Receipt footer" hint="Short line under totals on printed receipts.">
          <input
            className="input"
            value={settings.receiptFooter ?? ""}
            onChange={(e) => onChange({ receiptFooter: e.target.value })}
          />
        </SettingsField>
      </div>

      {(fieldErrors.taxPercent || fieldErrors.serviceChargePercent || fieldErrors.taxRoundingRule) && (
        <p className="text-xs text-rose-700">
          {fieldErrors.taxPercent || fieldErrors.serviceChargePercent || fieldErrors.taxRoundingRule}
        </p>
      )}
    </SettingsSection>
  );
}
