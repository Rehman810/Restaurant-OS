"use client";

import Image from "next/image";
import { Palette, Store } from "lucide-react";
import { SettingsField, SettingsSection } from "@/components/admin/SettingsSection";
import { SettingsSelect } from "@/components/admin/settings/SettingsSelect";
import { SettingsFormGrid } from "@/components/admin/settings/SettingsFormGrid";
import { applyBrandTheme, normalizeHexColor } from "@/lib/brand-theme";
import {
  BRAND_COLOR_PRESETS,
  brandContrastReport,
  darkenUntilContrast,
} from "@/lib/color-contrast";
import { resolveMediaUrl } from "@/lib/media-url";
import type { StoreSettings } from "@/lib/types";

type CurrencyChoice = { code: string; symbol: string; name: string };
type TimezoneChoice = { value: string; label: string };

type Props = {
  settings: StoreSettings;
  fieldErrors: Record<string, string>;
  onChange: (patch: Partial<StoreSettings>) => void;
  timezoneChoices: TimezoneChoice[];
  currencyChoices: CurrencyChoice[];
  activeCurrency?: CurrencyChoice;
  onCurrencyChange: (code: string) => void;
  logoUploading: boolean;
  logoError: string;
  onLogoUpload: (file: File) => void;
  faviconUploading: boolean;
  faviconError: string;
  onFaviconUpload: (file: File) => void;
};

export function BrandingThemeSettings({
  settings,
  fieldErrors,
  onChange,
  timezoneChoices,
  currencyChoices,
  activeCurrency,
  onCurrencyChange,
  logoUploading,
  logoError,
  onLogoUpload,
  faviconUploading,
  faviconError,
  onFaviconUpload,
}: Props) {
  const primary = normalizeHexColor(settings.primaryColor, "#ea580c");
  const accent = normalizeHexColor(settings.accentColor, "#c2410c");
  const contrast = brandContrastReport(primary, accent);
  const buttonCheck = contrast.find((c) => c.id === "button");
  const allPass = contrast.every((c) => c.pass);

  function applyPreset(preset: (typeof BRAND_COLOR_PRESETS)[number]) {
    onChange({ primaryColor: preset.primary, accentColor: preset.accent });
    applyBrandTheme(preset.primary, preset.accent);
  }

  function fixButtonContrast() {
    if (!buttonCheck || buttonCheck.pass) return;
    const fixed = darkenUntilContrast("#ffffff", primary, 3, true);
    onChange({ primaryColor: fixed.background });
    applyBrandTheme(fixed.background, accent);
  }

  return (
    <>
      <SettingsSection
        icon={Store}
        title="Branding"
        description="Name and identity on the website, emails, and receipts."
      >
        <SettingsFormGrid>
          <SettingsField label="Restaurant name" error={fieldErrors.storeName}>
            <input
              id="field-storeName"
              className="input"
              value={settings.storeName ?? ""}
              onChange={(e) => onChange({ storeName: e.target.value })}
              placeholder="Restaurant name"
            />
          </SettingsField>
          <SettingsField label="Tagline">
            <input
              className="input"
              value={settings.storeTagline ?? ""}
              onChange={(e) => onChange({ storeTagline: e.target.value })}
              placeholder="Order in minutes"
            />
          </SettingsField>
          <SettingsField label="City">
            <input
              className="input"
              value={settings.city ?? ""}
              onChange={(e) => onChange({ city: e.target.value })}
              placeholder="City"
            />
          </SettingsField>
          <SettingsField label="Timezone">
            <SettingsSelect
              aria-label="Timezone"
              value={settings.timezone ?? "Asia/Karachi"}
              onChange={(v) => onChange({ timezone: v })}
              options={timezoneChoices.map((tz) => ({ value: tz.value, label: tz.label }))}
            />
          </SettingsField>
          <SettingsField
            label="Currency"
            hint={`Symbol ${settings.currencySymbol ?? activeCurrency?.symbol ?? "Rs"} is used on menu prices and receipts.`}
          >
            <SettingsSelect
              aria-label="Currency"
              value={settings.currencyCode ?? "PKR"}
              onChange={onCurrencyChange}
              options={currencyChoices.map((currency) => ({
                value: currency.code,
                label: `${currency.code} (${currency.symbol}) — ${currency.name}`,
              }))}
            />
          </SettingsField>
          <SettingsField label="Currency symbol" hint="Updates automatically when currency changes.">
            <div
              className="flex min-h-11 w-full items-center rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm font-semibold text-stone-700 dark:border-stone-600 dark:bg-stone-800/50 dark:text-stone-300"
              aria-readonly="true"
            >
              {settings.currencySymbol ?? activeCurrency?.symbol ?? "Rs"}
            </div>
          </SettingsField>
          <SettingsField
            label="Logo"
            className="col-span-full"
            hint="Navbar, admin sidebar, and footer."
            error={logoError || undefined}
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="input flex-1"
                value={settings.logoUrl ?? ""}
                onChange={(e) => onChange({ logoUrl: e.target.value })}
                placeholder="Paste image URL or upload"
              />
              <label className="btn-ghost shrink-0 cursor-pointer justify-center">
                {logoUploading ? "Uploading…" : "Upload logo"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && onLogoUpload(e.target.files[0])}
                />
              </label>
            </div>
            {settings.logoUrl && (
              <div className="relative mt-3 h-14 w-40 overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
                <Image
                  src={resolveMediaUrl(settings.logoUrl)}
                  alt="Logo preview"
                  fill
                  className="object-contain p-2"
                  sizes="160px"
                />
              </div>
            )}
          </SettingsField>
          <SettingsField label="Favicon" hint="Browser tab icon. Square PNG works best." error={faviconError || undefined}>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="input flex-1"
                value={settings.faviconUrl ?? ""}
                onChange={(e) => onChange({ faviconUrl: e.target.value })}
                placeholder="https://… or upload"
              />
              <label className="btn-ghost shrink-0 cursor-pointer justify-center">
                {faviconUploading ? "Uploading…" : "Upload icon"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && onFaviconUpload(e.target.files[0])}
                />
              </label>
            </div>
          </SettingsField>
          <SettingsField label="Footer text" className="col-span-full">
            <input
              className="input"
              value={settings.footerText ?? ""}
              onChange={(e) => onChange({ footerText: e.target.value })}
            />
          </SettingsField>
        </SettingsFormGrid>
      </SettingsSection>

      <SettingsSection
        icon={Palette}
        title="Theme colors"
        description="Storefront, checkout, and admin accents. Save to persist; preview updates live while you edit."
      >
        <div className="flex flex-wrap gap-2">
          {BRAND_COLOR_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 transition hover:border-brand-300"
              onClick={() => applyPreset(preset)}
            >
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: preset.primary }} />
              {preset.name}
            </button>
          ))}
        </div>

        <SettingsFormGrid>
          <SettingsField label="Primary color" hint="Buttons, links, and highlights." error={fieldErrors.primaryColor}>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Primary color picker"
                className="h-11 w-14 shrink-0 cursor-pointer rounded-xl border border-stone-200 bg-white p-1"
                value={primary}
                onChange={(e) => onChange({ primaryColor: e.target.value })}
              />
              <input
                className="input flex-1 font-mono text-sm"
                value={settings.primaryColor ?? "#ea580c"}
                onChange={(e) => onChange({ primaryColor: e.target.value })}
                placeholder="#ea580c"
              />
            </div>
          </SettingsField>
          <SettingsField label="Accent color" hint="Hover states and darker gradients." error={fieldErrors.accentColor}>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Accent color picker"
                className="h-11 w-14 shrink-0 cursor-pointer rounded-xl border border-stone-200 bg-white p-1"
                value={accent}
                onChange={(e) => onChange({ accentColor: e.target.value })}
              />
              <input
                className="input flex-1 font-mono text-sm"
                value={settings.accentColor ?? "#c2410c"}
                onChange={(e) => onChange({ accentColor: e.target.value })}
                placeholder="#c2410c"
              />
            </div>
          </SettingsField>
        </SettingsFormGrid>

        <div
          className={`rounded-2xl border p-4 ${allPass ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/60"}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-stone-900">Contrast (WCAG)</p>
            {!allPass && buttonCheck && !buttonCheck.pass && (
              <button type="button" className="btn-ghost text-xs" onClick={fixButtonContrast}>
                Darken primary for buttons
              </button>
            )}
          </div>
          <ul className="mt-2 space-y-1.5 text-xs">
            {contrast.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-stone-700">{row.label}</span>
                <span className={row.pass ? "font-semibold text-emerald-800" : "font-semibold text-amber-900"}>
                  {row.pass ? "Pass" : "Low"} · {row.ratio.toFixed(2)}:1 (need {row.minRatio}:1)
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-800/40">
          <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Preview</span>
          <button
            type="button"
            className="pointer-events-none rounded-xl px-4 py-2 text-sm font-bold text-white shadow-sm"
            style={{ backgroundColor: primary }}
          >
            Order now
          </button>
          <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: primary }}>
            Badge
          </span>
          <span className="text-sm font-semibold" style={{ color: accent }}>
            Accent text
          </span>
          <a href="#" className="text-sm font-semibold" style={{ color: primary }} onClick={(e) => e.preventDefault()}>
            Link style
          </a>
        </div>
      </SettingsSection>
    </>
  );
}
