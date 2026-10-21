"use client";

import Link from "next/link";
import { Facebook, Instagram, MapPin, Phone, Share2, Youtube } from "lucide-react";
import { SettingsField, SettingsSection } from "@/components/admin/SettingsSection";
import { mapsDirectionsUrl, normalizePkPhone } from "@/lib/phone";
import type { StoreSettings } from "@/lib/types";
import { CONTACT_EDITED_ELSEWHERE, CONTACT_FIELD_USAGE } from "@/modules/settings/contact-sot";

const SOCIAL_FIELDS = [
  { key: "facebookUrl" as const, label: "Facebook", icon: Facebook, placeholder: "https://facebook.com/..." },
  { key: "instagramUrl" as const, label: "Instagram", icon: Instagram, placeholder: "https://instagram.com/..." },
  { key: "tiktokUrl" as const, label: "TikTok", icon: Share2, placeholder: "https://tiktok.com/..." },
  { key: "youtubeUrl" as const, label: "YouTube", icon: Youtube, placeholder: "https://youtube.com/..." },
];

function UsageTags({ field }: { field: keyof typeof CONTACT_FIELD_USAGE }) {
  return (
    <ul className="mt-1 flex flex-wrap gap-1">
      {CONTACT_FIELD_USAGE[field].map((place) => (
        <li
          key={place}
          className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600"
        >
          {place}
        </li>
      ))}
    </ul>
  );
}

type Props = {
  settings: StoreSettings;
  onChange: (patch: Partial<StoreSettings>) => void;
  fieldErrors: Record<string, string>;
};

export function ContactSocialSettings({ settings, onChange, fieldErrors }: Props) {
  const mapsUrl = mapsDirectionsUrl(settings.latitude, settings.longitude);
  const waDigits = (settings.whatsapp || "").replace(/\D/g, "");

  return (
    <>
      <SettingsSection
        icon={Phone}
        title="Contact"
        description="Single source of truth for how customers reach you on the website, checkout, and printed receipts."
      >
        <div className="rounded-2xl border border-brand-100 bg-brand-50/40 px-4 py-3 text-xs text-stone-700">
          <p className="font-semibold text-stone-900">Source of truth</p>
          <p className="mt-1 leading-relaxed">
            These fields feed the live storefront immediately after save (about 30s cache). Branch records can override
            contact for a specific location — edit those under{" "}
            <Link href="/admin/branches" className="font-semibold text-brand-700 hover:text-brand-800">
              Branches
            </Link>
            .
          </p>
          <ul className="mt-2 space-y-1">
            {CONTACT_EDITED_ELSEWHERE.map((row) => (
              <li key={row.href}>
                <Link href={row.href} className="font-semibold text-brand-700 hover:text-brand-800">
                  {row.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SettingsField
            label="Phone"
            hint="Saved as +92… Pakistan format. Shown as click-to-call."
            error={fieldErrors.phone}
          >
            <input
              className="input"
              value={settings.phone}
              onChange={(e) => onChange({ phone: e.target.value })}
              onBlur={(e) => onChange({ phone: normalizePkPhone(e.target.value) })}
            />
            <UsageTags field="phone" />
          </SettingsField>
          <SettingsField
            label="WhatsApp"
            hint="Used for the green chat button. Normalized to +92 on save."
            error={fieldErrors.whatsapp}
          >
            <input
              className="input"
              value={settings.whatsapp}
              onChange={(e) => onChange({ whatsapp: e.target.value })}
              onBlur={(e) => onChange({ whatsapp: normalizePkPhone(e.target.value) })}
            />
            <UsageTags field="whatsapp" />
          </SettingsField>
        </div>

        <SettingsField label="Street address" error={fieldErrors.address}>
          <input
            className="input"
            value={settings.address}
            onChange={(e) => onChange({ address: e.target.value })}
          />
          <UsageTags field="address" />
        </SettingsField>

        <div className="grid gap-4 sm:grid-cols-2">
          <SettingsField label="Latitude" error={fieldErrors.latitude}>
            <input
              className="input"
              type="number"
              step="any"
              value={settings.latitude ?? ""}
              onChange={(e) => onChange({ latitude: e.target.value })}
            />
          </SettingsField>
          <SettingsField label="Longitude" error={fieldErrors.longitude}>
            <input
              className="input"
              type="number"
              step="any"
              value={settings.longitude ?? ""}
              onChange={(e) => onChange({ longitude: e.target.value })}
            />
          </SettingsField>
        </div>
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800"
          >
            <MapPin size={14} />
            Preview pin on Google Maps
          </a>
        )}

        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Storefront preview</p>
          <ul className="mt-2 space-y-2 text-stone-800">
            <li className="flex gap-2">
              <Phone size={15} className="mt-0.5 shrink-0 text-brand-600" />
              {settings.phone ? (
                <a href={`tel:${settings.phone}`} className="font-semibold hover:underline">{settings.phone}</a>
              ) : (
                <span className="text-stone-400">No phone</span>
              )}
            </li>
            <li className="flex gap-2">
              <MapPin size={15} className="mt-0.5 shrink-0 text-brand-600" />
              <span>{settings.address?.trim() || "No address"}</span>
            </li>
            {waDigits && (
              <li className="text-xs text-stone-600">
                WhatsApp button → wa.me/{waDigits}
              </li>
            )}
          </ul>
        </div>

        <p className="text-sm text-stone-500">
          Order <strong>email</strong> alerts are in{" "}
          <Link href="/admin/settings/notifications" className="font-semibold text-brand-700 underline-offset-2 hover:underline">
            Notifications
          </Link>
          .
        </p>
      </SettingsSection>

      <SettingsSection icon={Share2} title="Social links" description="HTTPS links shown in the storefront footer.">
        <div className="grid gap-4 sm:grid-cols-2">
          {SOCIAL_FIELDS.map(({ key, label, icon: Icon, placeholder }) => (
            <SettingsField key={key} label={label} error={fieldErrors[key]}>
              <div className="flex overflow-hidden rounded-2xl border border-stone-200 bg-white transition focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-100">
                <span className="grid w-12 shrink-0 place-items-center border-r border-stone-100 bg-stone-50 text-stone-400">
                  <Icon size={16} />
                </span>
                <input
                  className="min-w-0 flex-1 border-0 bg-transparent px-4 py-3 text-sm outline-none placeholder:text-stone-400"
                  placeholder={placeholder}
                  value={settings[key]}
                  onChange={(e) => onChange({ [key]: e.target.value })}
                />
              </div>
              <UsageTags field={key} />
            </SettingsField>
          ))}
        </div>
      </SettingsSection>
    </>
  );
}
