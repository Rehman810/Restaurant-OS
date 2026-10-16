"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  ArrowUpToLine,
  Clock,
  Facebook,
  ImageIcon,
  Instagram,
  Mail,
  Phone,
  Store,
  Package,
  Palette,
  Plus,
  Save,
  Settings,
  Shield,
  Share2,
  Star,
  Trash2,
  Truck,
  Youtube,
} from "lucide-react";
import { ConfirmSheet } from "@/components/admin/ConfirmSheet";
import { OpeningHoursEditor } from "@/components/admin/OpeningHoursEditor";
import { TwoFactorSettings } from "@/components/admin/TwoFactorSettings";
import { ApprovalPinSettings } from "@/components/admin/ApprovalPinSettings";
import { SettingsField, SettingsSection } from "@/components/admin/SettingsSection";
import { api, apiUpload, ApiError } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/media-url";
import { currencyForCode, currencyOptions, symbolForCode, timezoneOptions } from "@/lib/locale-options";
import { isStoreOpen, generatedClosedMessage } from "@/lib/store-hours";
import { validateSettingsInput } from "@/lib/settings-validate";
import { PromoBanner, StoreSettings, Testimonial } from "@/lib/types";
import { AdminScopeBanner } from "@/components/admin/AdminScopeBanner";
import { applyBrandTheme, normalizeHexColor } from "@/lib/brand-theme";

type SettingsPayload = { settings: StoreSettings; banners: PromoBanner[]; testimonials: Testimonial[] };

const SOCIAL_FIELDS = [
  { key: "facebookUrl" as const, label: "Facebook", icon: Facebook, placeholder: "https://facebook.com/..." },
  { key: "instagramUrl" as const, label: "Instagram", icon: Instagram, placeholder: "https://instagram.com/..." },
  { key: "tiktokUrl" as const, label: "TikTok", icon: Share2, placeholder: "https://tiktok.com/..." },
  { key: "youtubeUrl" as const, label: "YouTube", icon: Youtube, placeholder: "https://youtube.com/..." },
];

const SETTINGS_TABS = [
  { id: "store", label: "Store" },
  { id: "contact", label: "Contact" },
  { id: "delivery", label: "Delivery" },
  { id: "hours", label: "Hours" },
  { id: "social", label: "Social" },
  { id: "banners", label: "Banners" },
  { id: "inventory", label: "Inventory" },
  { id: "controls", label: "Controls" },
  { id: "security", label: "Security" },
] as const;

type SettingsTab = (typeof SETTINGS_TABS)[number]["id"];

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [baseline, setBaseline] = useState("");
  const [banners, setBanners] = useState<PromoBanner[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [bannerForm, setBannerForm] = useState({ title: "", imageUrl: "", linkUrl: "" });
  const [bannerError, setBannerError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState("");
  const [tab, setTab] = useState<SettingsTab>("store");
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [testimonialForm, setTestimonialForm] = useState({ name: "", area: "", text: "", rating: 5 });
  const [bannerDeleteId, setBannerDeleteId] = useState<string | null>(null);
  const [bannerDeleting, setBannerDeleting] = useState(false);
  const [leavePromptOpen, setLeavePromptOpen] = useState(false);
  const [pendingLeaveHref, setPendingLeaveHref] = useState<string | null>(null);

  async function load() {
    const data = await api<SettingsPayload>("/settings");
    setSettings(data.settings);
    setBaseline(JSON.stringify(data.settings));
    setBanners(data.banners);
    setTestimonials(data.testimonials ?? []);
  }

  useEffect(() => {
    load().catch(() => setMsg("Could not load settings."));
  }, []);

  useEffect(() => {
    if (!settings) return;
    applyBrandTheme(settings.primaryColor, settings.accentColor);
  }, [settings?.primaryColor, settings?.accentColor]);

  async function onSave(e?: FormEvent) {
    e?.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMsg("");
    try {
      await api("/settings", { method: "PATCH", body: JSON.stringify(settings) });
      setBaseline(JSON.stringify(settings));
      setMsg("Settings saved successfully.");
      window.dispatchEvent(new Event("store-refresh"));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function onBannerUpload(file: File) {
    setUploading(true);
    setBannerError("");
    try {
      const { url } = await apiUpload("/upload/image", file);
      setBannerForm((f) => ({ ...f, imageUrl: url }));
    } catch (err) {
      setBannerError(err instanceof ApiError ? err.message : "Could not upload image");
    } finally {
      setUploading(false);
    }
  }

  async function onLogoUpload(file: File) {
    setLogoUploading(true);
    setLogoError("");
    try {
      const { url } = await apiUpload("/upload/image", file);
      setSettings((current) => (current ? { ...current, logoUrl: url } : current));
    } catch (err) {
      setLogoError(err instanceof ApiError ? err.message : "Could not upload logo");
    } finally {
      setLogoUploading(false);
    }
  }

  function refreshStorefront() {
    window.dispatchEvent(new Event("store-refresh"));
  }

  async function addBanner() {
    if (!bannerForm.imageUrl) return;
    setBannerError("");
    try {
      await api("/settings/banners", {
        method: "POST",
        body: JSON.stringify(bannerForm),
      });
      setBannerForm({ title: "", imageUrl: "", linkUrl: "" });
      await load();
      refreshStorefront();
    } catch (err) {
      setBannerError(err instanceof ApiError ? err.message : "Could not add banner");
    }
  }

  async function toggleBanner(b: PromoBanner) {
    await api(`/settings/banners/${b.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !b.isActive }),
    });
    await load();
    refreshStorefront();
  }

  function requestRemoveBanner(id: string) {
    setBannerDeleteId(id);
  }

  async function confirmRemoveBanner() {
    if (!bannerDeleteId) return;
    setBannerDeleting(true);
    try {
      await api(`/settings/banners/${bannerDeleteId}`, { method: "DELETE" });
      setBannerDeleteId(null);
      await load();
      refreshStorefront();
    } finally {
      setBannerDeleting(false);
    }
  }

  async function addTestimonial() {
    if (!testimonialForm.name.trim() || !testimonialForm.text.trim()) return;
    await api("/settings/testimonials", {
      method: "POST",
      body: JSON.stringify(testimonialForm),
    });
    setTestimonialForm({ name: "", area: "", text: "", rating: 5 });
    await load();
    refreshStorefront();
  }

  async function removeTestimonial(id: string) {
    await api(`/settings/testimonials/${id}`, { method: "DELETE" });
    await load();
    refreshStorefront();
  }

  async function pinBannerFirst(b: PromoBanner) {
    const minOrder = banners.reduce((min, item) => Math.min(min, item.sortOrder), b.sortOrder);
    await api(`/settings/banners/${b.id}`, {
      method: "PATCH",
      body: JSON.stringify({ sortOrder: minOrder - 1 }),
    });
    await load();
    refreshStorefront();
  }

  const fieldErrors = useMemo(
    () => (settings ? validateSettingsInput(settings as unknown as Record<string, unknown>) : {}),
    [settings]
  );
  const invalid = Object.keys(fieldErrors).length > 0;
  const dirty = Boolean(settings) && baseline !== "" && JSON.stringify(settings) !== baseline;

  useEffect(() => {
    const onBefore = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const onClick = (event: MouseEvent) => {
      if (!dirty) return;
      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingLeaveHref(href);
      setLeavePromptOpen(true);
    };
    window.addEventListener("beforeunload", onBefore);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBefore);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  if (!settings) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-36 rounded-3xl" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="skeleton h-72 rounded-3xl" />
          <div className="skeleton h-72 rounded-3xl" />
        </div>
        <div className="skeleton h-64 rounded-3xl" />
      </div>
    );
  }

  const storeOpen = isStoreOpen(settings);
  const closedHint = generatedClosedMessage(settings);
  const timezoneChoices = timezoneOptions(settings.timezone);
  const currencyChoices = currencyOptions(settings.currencyCode);
  const activeCurrency = currencyForCode(settings.currencyCode) ?? currencyChoices[0];

  function setCurrency(code: string) {
    setSettings((current) => {
      if (!current) return current;
      const match = currencyForCode(code) ?? currencyOptions(current.currencyCode).find((item) => item.code === code);
      return {
        ...current,
        currencyCode: code,
        currencySymbol: match?.symbol ?? symbolForCode(code),
      };
    });
  }

  return (
    <div className="space-y-6 pb-24">
      <AdminScopeBanner variant="chain" />
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-900 via-stone-900 to-brand-900 p-6 text-white shadow-xl sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-brand-300">
              <Settings size={16} />
              <span className="text-xs font-bold uppercase tracking-[0.2em]">Configuration</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl">Store settings</h1>
            <p className="mt-2 max-w-lg text-sm text-stone-300">
              Contact details, delivery rules, opening hours, and homepage banners.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                storeOpen ? "bg-emerald-500/20 text-emerald-200" : "bg-amber-500/20 text-amber-200"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${storeOpen ? "bg-emerald-400" : "bg-amber-400"}`} />
              {storeOpen ? "Storefront open" : "Storefront closed"}
            </span>
            <button
              type="button"
              onClick={() => onSave()}
              disabled={saving || invalid || !dirty || tab === "banners" || tab === "security"}
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-stone-900 transition hover:bg-brand-50 disabled:opacity-60"
            >
              <Save size={16} />
              {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </button>
          </div>
        </div>
      </div>

      {msg && (
        <p
          className={`rounded-2xl px-4 py-3 text-sm font-medium ${
            msg.includes("failed") || msg.includes("Could not")
              ? "bg-red-50 text-red-800"
              : "bg-emerald-50 text-emerald-800"
          }`}
        >
          {msg}
        </p>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {SETTINGS_TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                active ? "bg-stone-900 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "security" && (
        <div className="space-y-6">
          <ApprovalPinSettings />
          <TwoFactorSettings />
        </div>
      )}

      <form onSubmit={onSave} className={tab === "banners" || tab === "security" ? "hidden" : "space-y-6"}>
        {tab === "store" && (
        <SettingsSection
          icon={Store}
          title="Branding"
          description="Your restaurant name appears on the website, emails, and receipts."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingsField label="Restaurant name">
              <input
                className="input"
                value={settings.storeName ?? ""}
                onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                placeholder="Restaurant name"
              />
              {fieldErrors.storeName && <p className="mt-1 text-xs text-rose-700">{fieldErrors.storeName}</p>}
            </SettingsField>
            <SettingsField label="Tagline">
              <input
                className="input"
                value={settings.storeTagline ?? ""}
                onChange={(e) => setSettings({ ...settings, storeTagline: e.target.value })}
                placeholder="Order in minutes"
              />
            </SettingsField>
            <SettingsField label="City">
              <input
                className="input"
                value={settings.city ?? ""}
                onChange={(e) => setSettings({ ...settings, city: e.target.value })}
                placeholder="City"
              />
            </SettingsField>
            <SettingsField label="Timezone">
              <select
                className="input admin-select"
                value={settings.timezone ?? "Asia/Karachi"}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              >
                {timezoneChoices.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </SettingsField>
            <SettingsField
              label="Currency"
              hint={`Symbol ${settings.currencySymbol ?? activeCurrency?.symbol ?? "Rs"} is used on menu prices and receipts.`}
            >
              <select
                className="input admin-select"
                value={settings.currencyCode ?? "PKR"}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {currencyChoices.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code} ({currency.symbol}) — {currency.name}
                  </option>
                ))}
              </select>
            </SettingsField>
            <SettingsField label="Currency symbol" hint="Updates automatically when currency changes.">
              <select
                className="input admin-select bg-stone-50 text-stone-700"
                value={settings.currencySymbol ?? activeCurrency?.symbol ?? "Rs"}
                disabled
              >
                <option value={settings.currencySymbol ?? activeCurrency?.symbol ?? "Rs"}>
                  {settings.currencySymbol ?? activeCurrency?.symbol ?? "Rs"}
                </option>
              </select>
            </SettingsField>
            <SettingsField label="Logo" className="sm:col-span-2" hint="Shown in the navbar, admin sidebar, and footer. Paste a URL or upload, then save settings.">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  className="input flex-1"
                  value={settings.logoUrl ?? ""}
                  onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
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
              {logoError && <p className="mt-2 text-xs text-red-600">{logoError}</p>}
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
            <SettingsField label="Footer text">
              <input
                className="input"
                value={settings.footerText ?? ""}
                onChange={(e) => setSettings({ ...settings, footerText: e.target.value })}
              />
            </SettingsField>
          </div>
        </SettingsSection>
        )}

        {tab === "store" && (
        <SettingsSection
          icon={Palette}
          title="Theme colors"
          description="Primary and accent colors for your storefront, checkout, and admin accents. Save to apply everywhere."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingsField label="Primary color" hint="Buttons, links, and highlights.">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Primary color picker"
                  className="h-11 w-14 shrink-0 cursor-pointer rounded-xl border border-stone-200 bg-white p-1"
                  value={normalizeHexColor(settings.primaryColor, "#ea580c")}
                  onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                />
                <input
                  className="input flex-1 font-mono text-sm"
                  value={settings.primaryColor ?? "#ea580c"}
                  onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                  placeholder="#ea580c"
                />
              </div>
              {fieldErrors.primaryColor && <p className="mt-1 text-xs text-rose-700">{fieldErrors.primaryColor}</p>}
            </SettingsField>
            <SettingsField label="Accent color" hint="Hover states and darker gradients.">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Accent color picker"
                  className="h-11 w-14 shrink-0 cursor-pointer rounded-xl border border-stone-200 bg-white p-1"
                  value={normalizeHexColor(settings.accentColor, "#c2410c")}
                  onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })}
                />
                <input
                  className="input flex-1 font-mono text-sm"
                  value={settings.accentColor ?? "#c2410c"}
                  onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })}
                  placeholder="#c2410c"
                />
              </div>
              {fieldErrors.accentColor && <p className="mt-1 text-xs text-rose-700">{fieldErrors.accentColor}</p>}
            </SettingsField>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-800/40">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Preview</span>
            <button type="button" className="btn-primary pointer-events-none">Order now</button>
            <span
              className="rounded-full px-3 py-1 text-xs font-bold text-white"
              style={{ backgroundColor: normalizeHexColor(settings.primaryColor, "#ea580c") }}
            >
              Badge
            </span>
            <span
              className="text-sm font-semibold"
              style={{ color: normalizeHexColor(settings.accentColor, "#c2410c") }}
            >
              Accent text
            </span>
          </div>
        </SettingsSection>
        )}

        {tab === "store" && (
        <SettingsSection
          icon={Star}
          title="Storefront reviews"
          description="Published testimonials appear on the homepage. Live order stats need at least 10 completed orders."
        >
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-stone-900">Show reviews section on homepage</p>
              <p className="text-xs text-stone-500">Turn off to hide ratings and testimonials without deleting them.</p>
            </div>
            <input
              type="checkbox"
              className="h-5 w-5 shrink-0 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
              checked={settings.showReviewsSection ?? true}
              onChange={(e) => setSettings({ ...settings, showReviewsSection: e.target.checked })}
            />
          </label>
          <label className="mt-3 flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-stone-900">Show live order count</p>
              <p className="text-xs text-stone-500">Displays total orders next to your average rating when enabled.</p>
            </div>
            <input
              type="checkbox"
              className="h-5 w-5 shrink-0 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
              checked={settings.showLiveStats ?? false}
              onChange={(e) => setSettings({ ...settings, showLiveStats: e.target.checked })}
            />
          </label>
        </SettingsSection>
        )}

        {tab === "contact" && (
          <SettingsSection
            icon={Phone}
            title="Contact & notifications"
            description="Store contact details and optional staff email alerts."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <SettingsField label="Phone">
                <input
                  className="input"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                />
              </SettingsField>
              <SettingsField label="WhatsApp" hint="Digits only, with country code">
                <input
                  className="input"
                  value={settings.whatsapp}
                  onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })}
                />
              </SettingsField>
            </div>
            <SettingsField label="Address">
              <input
                className="input"
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              />
            </SettingsField>
            <SettingsField
              label="Google Place ID"
              hint="For live Google reviews on homepage. Find it in Google Maps → Share → Embed. Requires GOOGLE_PLACES_API_KEY on server."
            >
              <input
                className="input"
                placeholder="ChIJ..."
                value={settings.googlePlaceId ?? ""}
                onChange={(e) => setSettings({ ...settings, googlePlaceId: e.target.value })}
              />
            </SettingsField>
            <div className="grid gap-4 sm:grid-cols-2">
              <SettingsField label="Latitude">
                <input
                  className="input"
                  type="number"
                  step="any"
                  value={settings.latitude ?? ""}
                  onChange={(e) => setSettings({ ...settings, latitude: e.target.value })}
                />
              </SettingsField>
              <SettingsField label="Longitude">
                <input
                  className="input"
                  type="number"
                  step="any"
                  value={settings.longitude ?? ""}
                  onChange={(e) => setSettings({ ...settings, longitude: e.target.value })}
                />
              </SettingsField>
            </div>

            <div className="border-t border-stone-100 pt-5">
              <div className="mb-3 flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <Mail size={16} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-stone-900">Staff email notifications</p>
                  <p className="text-xs text-stone-500">Admin always receives new-order alerts.</p>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { key: "emailNotifyChef" as const, label: "Chef", hint: "New order alerts" },
                  { key: "emailNotifyCashier" as const, label: "Cashier", hint: "New order alerts" },
                  { key: "emailNotifyRider" as const, label: "Rider", hint: "Delivery assignment emails" },
                ].map(({ key, label, hint }) => (
                  <label
                    key={key}
                    className={`flex cursor-pointer items-center justify-between gap-4 rounded-2xl border px-4 py-3 transition ${
                      settings[key] ?? true
                        ? "border-brand-200 bg-brand-50/60"
                        : "border-stone-200 bg-stone-50"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stone-900">{label}</p>
                      <p className="text-xs text-stone-500">{hint}</p>
                    </div>
                    <input
                      type="checkbox"
                      className="h-5 w-5 shrink-0 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                      checked={settings[key] ?? true}
                      onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })}
                    />
                  </label>
                ))}
              </div>
            </div>
          </SettingsSection>
        )}

        {tab === "delivery" && (
          <SettingsSection icon={Truck} title="Orders & delivery" description="Minimums, free delivery threshold, and time estimates.">
            <div className="grid gap-4 sm:grid-cols-2">
              <SettingsField label={`Minimum order (${settings.currencySymbol ?? "Rs"})`}>
                <input
                  className="input"
                  type="number"
                  value={settings.minimumOrder}
                  onChange={(e) => setSettings({ ...settings, minimumOrder: e.target.value })}
                />
              </SettingsField>
              <SettingsField label={`Free delivery above (${settings.currencySymbol ?? "Rs"})`}>
                <input
                  className="input"
                  type="number"
                  value={settings.freeDeliveryAbove ?? ""}
                  onChange={(e) => setSettings({ ...settings, freeDeliveryAbove: e.target.value || null })}
                />
              </SettingsField>
              <SettingsField label="Delivery estimate (min)">
                <input
                  className="input"
                  type="number"
                  value={settings.deliveryEstimateMin}
                  onChange={(e) => setSettings({ ...settings, deliveryEstimateMin: Number(e.target.value) })}
                />
              </SettingsField>
              <SettingsField label="Takeaway estimate (min)">
                <input
                  className="input"
                  type="number"
                  value={settings.pickupEstimateMin}
                  onChange={(e) => setSettings({ ...settings, pickupEstimateMin: Number(e.target.value) })}
                />
              </SettingsField>
              <SettingsField label="Confirm SLA (min)" hint="Highlight orders waiting longer than this">
                <input
                  className="input"
                  type="number"
                  value={settings.confirmSlaMinutes ?? 15}
                  onChange={(e) => setSettings({ ...settings, confirmSlaMinutes: Number(e.target.value) })}
                />
              </SettingsField>
              <SettingsField label="Delivery SLA (min)">
                <input
                  className="input"
                  type="number"
                  value={settings.deliverySlaMinutes ?? 45}
                  onChange={(e) => setSettings({ ...settings, deliverySlaMinutes: Number(e.target.value) })}
                />
              </SettingsField>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={settings.acceptCash !== false}
                  onChange={(e) => setSettings({ ...settings, acceptCash: e.target.checked })}
                />
                <span>
                  <span className="block text-sm font-semibold text-stone-900">Cash on delivery</span>
                  <span className="text-xs text-stone-500">Shown at checkout and in the FAQ.</span>
                </span>
              </label>
            <label className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <input
                type="checkbox"
                className="mt-1"
                checked={settings.acceptCard !== false}
                onChange={(e) => setSettings({ ...settings, acceptCard: e.target.checked })}
              />
              <span>
                <span className="block text-sm font-semibold text-stone-900">Card at the counter</span>
                <span className="text-xs text-stone-500">POS only. No online card gateway.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4 sm:col-span-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={Boolean(settings.storefrontPushEnabled)}
                onChange={(e) => setSettings({ ...settings, storefrontPushEnabled: e.target.checked })}
              />
              <span>
                <span className="block text-sm font-semibold text-stone-900">Order status push (PWA)</span>
                <span className="text-xs text-stone-500">
                  Lets customers opt in on the order tracking page. Requires VAPID keys on the API server.
                </span>
              </span>
            </label>
          </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <SettingsField label={settings.taxLabel || "Tax"} hint="Percent. Leave 0 to hide.">
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={settings.taxPercent ?? 0}
                  onChange={(e) => setSettings({ ...settings, taxPercent: e.target.value })}
                />
              </SettingsField>
              <SettingsField label="Tax label">
                <input
                  className="input"
                  value={settings.taxLabel ?? "Tax"}
                  onChange={(e) => setSettings({ ...settings, taxLabel: e.target.value })}
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
                  onChange={(e) => setSettings({ ...settings, serviceChargePercent: e.target.value })}
                />
              </SettingsField>
              <SettingsField label="Service label">
                <input
                  className="input"
                  value={settings.serviceChargeLabel ?? "Service charge"}
                  onChange={(e) => setSettings({ ...settings, serviceChargeLabel: e.target.value })}
                />
              </SettingsField>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2 font-medium text-stone-700">
                <input
                  type="checkbox"
                  checked={Boolean(settings.taxIncluded)}
                  onChange={(e) => setSettings({ ...settings, taxIncluded: e.target.checked })}
                />
                Tax included in prices
              </label>
              <label className="flex items-center gap-2 font-medium text-stone-700">
                <input
                  type="checkbox"
                  checked={Boolean(settings.serviceIncluded)}
                  onChange={(e) => setSettings({ ...settings, serviceIncluded: e.target.checked })}
                />
                Service included in prices
              </label>
            </div>
            <label className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <input
                type="checkbox"
                className="mt-1"
                checked={Boolean(settings.taxEnabled)}
                onChange={(e) => setSettings({ ...settings, taxEnabled: e.target.checked })}
              />
              <span>
                <span className="block text-sm font-semibold text-stone-900">Tax invoicing mode</span>
                <span className="text-xs text-stone-500">
                  Snapshots tax on orders, issues TAX-* invoice numbers, and enables tax reports. See docs/TAX_INVOICING_NOTES.md.
                </span>
              </span>
            </label>
            {settings.taxEnabled && (
              <div className="grid gap-4 sm:grid-cols-2">
                <SettingsField label="Legal business name">
                  <input
                    className="input"
                    value={settings.taxLegalName ?? ""}
                    onChange={(e) => setSettings({ ...settings, taxLegalName: e.target.value })}
                  />
                </SettingsField>
                <SettingsField label="STRN">
                  <input
                    className="input"
                    value={settings.taxStrn ?? ""}
                    onChange={(e) => setSettings({ ...settings, taxStrn: e.target.value })}
                  />
                </SettingsField>
                <SettingsField label="Business address" className="sm:col-span-2">
                  <input
                    className="input"
                    value={settings.taxBusinessAddress ?? ""}
                    onChange={(e) => setSettings({ ...settings, taxBusinessAddress: e.target.value })}
                  />
                </SettingsField>
                <label className="flex items-center gap-2 text-sm font-medium text-stone-700 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={Boolean(settings.pricesIncludeTax ?? settings.taxIncluded)}
                    onChange={(e) =>
                      setSettings({ ...settings, pricesIncludeTax: e.target.checked, taxIncluded: e.target.checked })
                    }
                  />
                  Menu prices include tax (when tax mode is on)
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-stone-700 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={Boolean(settings.taxFiscalYearEnabled)}
                    onChange={(e) => setSettings({ ...settings, taxFiscalYearEnabled: e.target.checked })}
                  />
                  Fiscal-year invoice sequence (vs daily)
                </label>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <SettingsField label="Tax registration number (NTN)" hint="Optional. Printed on receipts.">
                <input
                  className="input"
                  value={settings.taxNumber ?? ""}
                  onChange={(e) => setSettings({ ...settings, taxNumber: e.target.value })}
                />
              </SettingsField>
              <SettingsField label="Receipt footer">
                <input
                  className="input"
                  value={settings.receiptFooter ?? ""}
                  onChange={(e) => setSettings({ ...settings, receiptFooter: e.target.value })}
                />
              </SettingsField>
            </div>
            {(fieldErrors.taxPercent || fieldErrors.serviceChargePercent || fieldErrors.phone || fieldErrors.latitude) && (
              <p className="text-xs text-rose-700">
                {fieldErrors.taxPercent || fieldErrors.serviceChargePercent || fieldErrors.phone || fieldErrors.latitude}
              </p>
            )}
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                settings.autoConfirmOrders
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-orange-200 bg-orange-50"
              }`}
            >
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-stone-300 text-brand-600"
                checked={settings.autoConfirmOrders}
                onChange={(e) => setSettings({ ...settings, autoConfirmOrders: e.target.checked })}
              />
              <div>
                <p className="text-sm font-semibold text-stone-900">Confirm orders instantly</p>
                <p className="mt-1 text-xs leading-relaxed text-stone-600">
                  {settings.autoConfirmOrders
                    ? "New orders go straight to the kitchen. Customers get a confirmation email immediately."
                    : "New orders wait for your call. Use Confirm on the order after you verify by phone."}
                </p>
              </div>
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
                onChange={(e) => setSettings({ ...settings, offlinePosEnabled: e.target.checked })}
              />
              <div>
                <p className="text-sm font-semibold text-stone-900">Offline POS</p>
                <p className="mt-1 text-xs leading-relaxed text-stone-600">
                  Allow cashiers to queue dine-in and takeaway orders on devices when the internet drops. Sync requires connectivity.
                </p>
              </div>
            </label>
            <SettingsField
              label="Offline clock skew alert (minutes)"
              hint="Orders synced from devices whose clock differs from the server by more than this are flagged for review."
            >
              <input
                type="number"
                min={1}
                max={1440}
                className="input w-full max-w-xs"
                value={settings.offlineClockSkewThresholdMinutes ?? 10}
                onChange={(e) =>
                  setSettings({
                    ...settings,
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
                onChange={(e) => setSettings({ ...settings, autoPrintKitchenTickets: e.target.checked })}
              />
              <div>
                <p className="text-sm font-semibold text-stone-900">Auto-print kitchen tickets</p>
                <p className="mt-1 text-xs leading-relaxed text-stone-600">
                  When enabled, the kitchen board opens a browser print dialog for each new confirmed order (allow pop-ups).
                  Tickets split by print station.
                </p>
              </div>
            </label>
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                settings.autoAssignRiders
                  ? "border-violet-300 bg-violet-50"
                  : "border-stone-200 bg-stone-50"
              }`}
            >
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-stone-300 text-brand-600"
                checked={settings.autoAssignRiders ?? true}
                onChange={(e) => setSettings({ ...settings, autoAssignRiders: e.target.checked })}
              />
              <div>
                <p className="text-sm font-semibold text-stone-900">Auto-assign riders</p>
                <p className="mt-1 text-xs leading-relaxed text-stone-600">
                  {settings.autoAssignRiders ?? true
                    ? "When an order goes out for delivery, the least-busy rider is assigned automatically."
                    : "Pick a rider manually from the order panel before dispatching."}
                </p>
              </div>
            </label>
          </SettingsSection>
        )}

        {tab === "hours" && (
        <SettingsSection
          icon={Clock}
          title="Hours & availability"
          description={`When customers can order. Times use ${settings.timezone || "the restaurant timezone"}.`}
        >
          <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start">
            <OpeningHoursEditor
              settings={settings}
              onChange={(patch) => setSettings({ ...settings, ...patch })}
            />

            <div className="space-y-4">
              <SettingsField label="Closed message" hint="Leave blank to use the schedule. Hours on the site always follow the schedule.">
                <textarea
                  className="input min-h-24 resize-none"
                  value={settings.closedMessage}
                  placeholder={closedHint}
                  onChange={(e) => setSettings({ ...settings, closedMessage: e.target.value })}
                />
              </SettingsField>

              <label
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                  settings.forceClosed
                    ? "border-amber-300 bg-amber-50"
                    : "border-stone-200 bg-stone-50 hover:border-stone-300"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                  checked={settings.forceClosed}
                  onChange={(e) => setSettings({ ...settings, forceClosed: e.target.checked })}
                />
                <div>
                  <p className="text-sm font-semibold text-stone-900">Force closed</p>
                  <p className="mt-1 text-xs leading-relaxed text-stone-500">
                    Override opening hours and block all orders until you turn this off.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </SettingsSection>
        )}

        {tab === "social" && (
        <SettingsSection
          icon={Share2}
          title="Social links"
          description="Optional links shown in the storefront footer."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {SOCIAL_FIELDS.map(({ key, label, icon: Icon, placeholder }) => (
              <SettingsField key={key} label={label}>
                <div className="flex overflow-hidden rounded-2xl border border-stone-200 bg-white transition focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-100">
                  <span className="grid w-12 shrink-0 place-items-center border-r border-stone-100 bg-stone-50 text-stone-400">
                    <Icon size={16} />
                  </span>
                  <input
                    className="min-w-0 flex-1 border-0 bg-transparent px-4 py-3 text-sm outline-none placeholder:text-stone-400"
                    placeholder={placeholder}
                    value={settings[key]}
                    onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                  />
                </div>
              </SettingsField>
            ))}
          </div>
        </SettingsSection>
        )}

        {tab === "social" && (
        <SettingsSection
          icon={Star}
          title="Customer testimonials"
          description="Short quotes from real customers. Only published entries appear on the homepage when reviews are enabled."
        >
          {testimonials.length === 0 ? (
            <p className="text-sm text-stone-500">No testimonials yet. Add one below.</p>
          ) : (
            <ul className="space-y-2">
              {testimonials.map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-900">{t.name}</p>
                    <p className="text-xs text-stone-500">{t.area || "Customer"} · {t.rating}★</p>
                    <p className="mt-1 text-sm text-stone-600">{t.text}</p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-xs font-semibold text-rose-600 hover:underline"
                    onClick={() => void removeTestimonial(t.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              className="input"
              placeholder="Customer name"
              value={testimonialForm.name}
              onChange={(e) => setTestimonialForm({ ...testimonialForm, name: e.target.value })}
            />
            <input
              className="input"
              placeholder="Area (optional)"
              value={testimonialForm.area}
              onChange={(e) => setTestimonialForm({ ...testimonialForm, area: e.target.value })}
            />
          </div>
          <textarea
            className="input mt-3 min-h-[88px]"
            placeholder="Review text"
            value={testimonialForm.text}
            onChange={(e) => setTestimonialForm({ ...testimonialForm, text: e.target.value })}
          />
          <button type="button" className="btn-primary mt-3" onClick={() => void addTestimonial()}>
            <Plus size={16} /> Add testimonial
          </button>
        </SettingsSection>
        )}
      </form>

      {tab === "controls" && settings && (
        <SettingsSection
          icon={Shield}
          title="POS controls"
          description="Manager approval rules for voids, refunds, and discounts."
        >
          <SettingsField
            label="Max cashier discount (%)"
            hint="Cashiers can discount up to this percent without a manager PIN."
          >
            <input
              type="number"
              min={0}
              max={100}
              className="input w-full max-w-xs"
              value={settings.maxCashierDiscountPercent ?? 10}
              onChange={(e) =>
                setSettings({ ...settings, maxCashierDiscountPercent: e.target.value })
              }
            />
          </SettingsField>
          {(
            [
              ["requireApprovalForVoid", "Require manager approval to void orders"],
              ["requireApprovalForRefund", "Require manager approval for refunds"],
              ["requireApprovalForPriceOverride", "Require manager approval for price overrides"],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 dark:border-stone-600 dark:bg-stone-800/50"
            >
              <span className="text-sm font-medium text-stone-900 dark:text-stone-100">{label}</span>
              <input
                type="checkbox"
                className="h-5 w-5 shrink-0 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                checked={Boolean(settings[key])}
                onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })}
              />
            </label>
          ))}
          <SettingsField
            label="Void reasons (one per line)"
            hint="Shown when staff void or cancel orders."
          >
            <textarea
              className="input min-h-[88px] w-full font-mono text-sm"
              value={(settings.voidReasonOptions ?? []).join("\n")}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  voidReasonOptions: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                })
              }
            />
          </SettingsField>
          <SettingsField label="Discount reasons (one per line)">
            <textarea
              className="input min-h-[88px] w-full font-mono text-sm"
              value={(settings.discountReasonOptions ?? []).join("\n")}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  discountReasonOptions: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                })
              }
            />
          </SettingsField>
          <SettingsField
            label="Shift variance tolerance (Rs)"
            hint="Closing variance above this amount requires a manager note."
          >
            <input
              type="number"
              min={0}
              className="input w-full max-w-xs"
              value={settings.shiftVarianceTolerance ?? 500}
              onChange={(e) =>
                setSettings({ ...settings, shiftVarianceTolerance: e.target.value })
              }
            />
          </SettingsField>
          <SettingsField
            label="Rider cash stale alert (hours)"
            hint="Dashboard flags pending COD older than this many hours."
          >
            <input
              type="number"
              min={1}
              max={336}
              className="input w-full max-w-xs"
              value={settings.riderCashStaleHours ?? 24}
              onChange={(e) =>
                setSettings({ ...settings, riderCashStaleHours: Number(e.target.value) || 24 })
              }
            />
          </SettingsField>
          <SettingsField label="Refund reasons (one per line)">
            <textarea
              className="input min-h-[88px] w-full font-mono text-sm"
              value={(settings.refundReasonOptions ?? []).join("\n")}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  refundReasonOptions: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                })
              }
            />
          </SettingsField>
        </SettingsSection>
      )}

      {tab === "inventory" && settings && (
        <SettingsSection
          icon={Package}
          title="Inventory & menu"
          description="Stock rules that affect the storefront and kitchen."
        >
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 dark:border-stone-600 dark:bg-stone-800/50">
            <div>
              <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">Auto-hide menu items</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Automatically hide menu items when their ingredients run out of stock.
              </p>
            </div>
            <input
              type="checkbox"
              className="h-5 w-5 shrink-0 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
              checked={settings.inventoryAutoHideMenu ?? false}
              onChange={(e) => setSettings({ ...settings, inventoryAutoHideMenu: e.target.checked })}
            />
          </label>
        </SettingsSection>
      )}

      {tab === "banners" && (
      <SettingsSection
        icon={ImageIcon}
        title="Promo banners"
        description="All live banners rotate on the homepage carousel. New banners appear first. Hide or delete old defaults you no longer need."
      >
        {banners.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-4 py-8 text-center">
            <ImageIcon size={28} className="mx-auto text-stone-300" />
            <p className="mt-2 text-sm font-medium text-stone-600">No banners yet</p>
            <p className="text-xs text-stone-400">Add your first promo image below</p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {banners.map((b) => (
              <li
                key={b.id}
                className="group overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-brand-200 hover:shadow-sm"
              >
                <div className="relative aspect-[16/7] bg-stone-100">
                  {b.imageUrl ? (
                    <Image src={resolveMediaUrl(b.imageUrl)} alt={b.title || "Banner"} fill className="object-cover" sizes="400px" />
                  ) : (
                    <div className="grid h-full place-items-center text-stone-300">
                      <ImageIcon size={24} />
                    </div>
                  )}
                  <span
                    className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                      b.isActive ? "bg-emerald-500 text-white" : "bg-stone-800/70 text-white"
                    }`}
                  >
                    {b.isActive ? "Live" : "Hidden"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-stone-900">{b.title || "Untitled banner"}</p>
                    <p className="truncate text-xs text-stone-500">{b.linkUrl || "No link"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => pinBannerFirst(b)}
                    className="grid h-8 w-8 place-items-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                    aria-label="Show this banner first"
                    title="Show first"
                  >
                    <ArrowUpToLine size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleBanner(b)}
                    className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-100"
                  >
                    {b.isActive ? "Hide" : "Show"}
                  </button>
                  <button
                    type="button"
                    onClick={() => requestRemoveBanner(b.id)}
                    className="grid h-8 w-8 place-items-center rounded-full text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                    aria-label="Delete banner"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="rounded-2xl border border-dashed border-brand-200 bg-[#fffaf5] p-4 sm:p-5">
          <p className="mb-3 text-sm font-semibold text-stone-800">Add new banner</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <SettingsField label="Title (optional)">
              <input
                className="input"
                placeholder="e.g. Biryani night"
                value={bannerForm.title}
                onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })}
              />
            </SettingsField>
            <SettingsField label="Link URL (optional)">
              <input
                className="input"
                placeholder="/menu or https://..."
                value={bannerForm.linkUrl}
                onChange={(e) => setBannerForm({ ...bannerForm, linkUrl: e.target.value })}
              />
            </SettingsField>
          </div>
          <SettingsField label="Banner image" className="mt-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="input flex-1"
                placeholder="Paste image URL or upload"
                value={bannerForm.imageUrl}
                onChange={(e) => setBannerForm({ ...bannerForm, imageUrl: e.target.value })}
              />
              <label className="btn-ghost shrink-0 cursor-pointer justify-center">
                {uploading ? "Uploading…" : "Upload image"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && onBannerUpload(e.target.files[0])}
                />
              </label>
            </div>
          </SettingsField>
          {bannerError && <p className="mt-2 text-sm text-red-600">{bannerError}</p>}
          {bannerForm.imageUrl && (
            <div className="relative mt-3 aspect-[16/7] max-h-40 overflow-hidden rounded-xl border border-stone-200">
              <Image src={resolveMediaUrl(bannerForm.imageUrl)} alt="Preview" fill className="object-cover" sizes="600px" />
            </div>
          )}
          <button
            type="button"
            className="btn-primary mt-4 w-full sm:w-auto"
            onClick={addBanner}
            disabled={!bannerForm.imageUrl}
          >
            <Plus size={16} /> Add banner
          </button>
        </div>
      </SettingsSection>
      )}

      <ConfirmSheet
        open={bannerDeleteId !== null}
        title="Delete banner?"
        message="This removes the banner from your homepage carousel. You can upload it again later."
        confirmLabel="Delete"
        danger
        saving={bannerDeleting}
        onClose={() => !bannerDeleting && setBannerDeleteId(null)}
        onConfirm={() => void confirmRemoveBanner()}
      />
      <ConfirmSheet
        open={leavePromptOpen}
        title="Leave without saving?"
        message="You have unsaved settings. If you leave now, your changes will be lost."
        confirmLabel="Leave"
        danger
        saving={false}
        onClose={() => {
          setLeavePromptOpen(false);
          setPendingLeaveHref(null);
        }}
        onConfirm={() => {
          const href = pendingLeaveHref;
          setLeavePromptOpen(false);
          setPendingLeaveHref(null);
          if (href) window.location.href = href;
        }}
      />

      {tab !== "banners" && tab !== "security" && (
      <div className="fixed bottom-20 left-0 right-0 z-20 px-4 lg:bottom-6 lg:left-72 lg:right-0">
        <div className={`mx-auto flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-md ${
          dirty ? "border-amber-300 bg-amber-50/95" : "border-stone-200 bg-white/95"
        }`}>
          <p className={`hidden text-sm sm:block ${dirty ? "font-medium text-amber-950" : "text-stone-500"}`}>
            {dirty
              ? "Unsaved changes. Uploaded logos are included when you save."
              : "Saved. The storefront matches these settings."}
          </p>
          <button
            type="button"
            onClick={() => onSave()}
            disabled={saving || invalid || !dirty}
            className="btn-primary ml-auto shrink-0"
          >
            <Save size={16} />
            {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </button>
        </div>
      </div>
      )}
    </div>
  );
}
