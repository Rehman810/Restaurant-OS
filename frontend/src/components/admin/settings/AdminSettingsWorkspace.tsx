"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  Clock,
  Plus,
  Save,
  Star,
  Truck,
} from "lucide-react";
import { ConfirmSheet } from "@/components/admin/ConfirmSheet";
import { OpeningHoursEditor } from "@/components/admin/OpeningHoursEditor";
import { SpecialHoursEditor } from "@/components/admin/SpecialHoursEditor";
import { MyAccountSettings } from "@/components/admin/settings/MyAccountSettings";
import { SettingsField, SettingsSection } from "@/components/admin/SettingsSection";
import { api, apiUpload, ApiError } from "@/lib/api";
import { SettingsSaveBar } from "@/components/admin/settings/SettingsSaveBar";
import {
  SettingsConflictDiff,
  SettingsConflictSheet,
} from "@/components/admin/settings/SettingsConflictSheet";
import {
  countSectionDirtyChanges,
  pickSectionFromSettings,
  STOREFRONT_ISR_SECONDS,
  STOREFRONT_SETTINGS_SECTIONS,
} from "@/modules/settings/section-fields";
import {
  isSettingsConflict,
  patchSettingsSection,
  revalidateStorefront,
  restoreSettingsFromHistory,
} from "@/modules/settings/api";
import { dangerousImpactsForSection } from "@/modules/settings/dangerous";
import { SettingsDangerousConfirmSheet } from "@/components/admin/settings/SettingsDangerousConfirmSheet";
import { TaxReceiptsSettings } from "@/components/admin/settings/TaxReceiptsSettings";
import { NotificationsSettings } from "@/components/admin/settings/NotificationsSettings";
import { ContactSocialSettings } from "@/components/admin/settings/ContactSocialSettings";
import { BrandingThemeSettings } from "@/components/admin/settings/BrandingThemeSettings";
import { IntegrationsSettings } from "@/components/admin/settings/IntegrationsSettings";
import { BannersSettings } from "@/components/admin/settings/BannersSettings";
import { InventoryMenuSettings } from "@/components/admin/settings/InventoryMenuSettings";
import { CostingSettings } from "@/components/admin/settings/CostingSettings";
import { PosControlsApprovalsSettings } from "@/components/admin/settings/PosControlsApprovalsSettings";
import { DevicesPrintingSettings } from "@/components/admin/settings/DevicesPrintingSettings";
import { withEmailNotifyDefaults } from "@/modules/settings/notification-matrix";
import dynamic from "next/dynamic";
import { History } from "lucide-react";

const SettingsHistoryDrawer = dynamic(
  () => import("@/components/admin/settings/SettingsHistoryDrawer").then((m) => m.SettingsHistoryDrawer),
  { ssr: false }
);
import { currencyForCode, currencyOptions, symbolForCode, timezoneOptions } from "@/lib/locale-options";
import { generatedClosedMessage } from "@/lib/store-hours";
import { validateSettingsInput } from "@/lib/settings-validate";
import { PromoBanner, StoreSettings, Testimonial } from "@/lib/types";
import { AdminScopeBanner } from "@/components/admin/AdminScopeBanner";
import { SettingsPageHeader } from "@/components/admin/settings/SettingsPageHeader";
import { AlertThresholdsSettings } from "@/components/admin/settings/AlertThresholdsSettings";
import { ScheduledReportsSettings } from "@/components/admin/settings/ScheduledReportsSettings";
import { applyBrandTheme } from "@/lib/brand-theme";
import Link from "next/link";
import {
  SETTINGS_SECTION_BY_ID,
  SettingsSectionId,
  settingsPath,
} from "@/modules/settings/ia";

type SettingsPayload = { settings: StoreSettings; banners: PromoBanner[]; testimonials: Testimonial[] };

export function AdminSettingsWorkspace({ section }: { section: SettingsSectionId }) {
  const sectionDef = SETTINGS_SECTION_BY_ID[section];
  const { user } = useAuth();
  const accountSection = section === "my-account";
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [sectionBaseline, setSectionBaseline] = useState<Record<string, unknown>>({});
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictDiff, setConflictDiff] = useState<SettingsConflictDiff>({});
  const [conflictServerSettings, setConflictServerSettings] = useState<StoreSettings | null>(null);
  const [banners, setBanners] = useState<PromoBanner[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [bannerForm, setBannerForm] = useState({ title: "", imageUrl: "", linkUrl: "" });
  const [bannerError, setBannerError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [faviconError, setFaviconError] = useState("");
  const [logoError, setLogoError] = useState("");
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [testimonialForm, setTestimonialForm] = useState({ name: "", area: "", text: "", rating: 5 });
  const [bannerDeleteId, setBannerDeleteId] = useState<string | null>(null);
  const [bannerDeleting, setBannerDeleting] = useState(false);
  const [leavePromptOpen, setLeavePromptOpen] = useState(false);
  const [pendingLeaveHref, setPendingLeaveHref] = useState<string | null>(null);
  const [analyticsEmailTesting, setAnalyticsEmailTesting] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [dangerousOpen, setDangerousOpen] = useState(false);
  const [dangerousImpacts, setDangerousImpacts] = useState<{ key: string; text: string }[]>([]);
  const [pendingConfirmSave, setPendingConfirmSave] = useState(false);

  async function load() {
    const data = await api<SettingsPayload>("/settings");
    const normalized = withEmailNotifyDefaults(data.settings);
    setSettings(normalized);
    setSectionBaseline(pickSectionFromSettings(section, normalized));
    setServerFieldErrors({});
    setBanners(data.banners);
    setTestimonials(data.testimonials ?? []);
  }

  useEffect(() => {
    if (accountSection) return;
    load().catch(() => setMsg("Could not load settings."));
  }, [accountSection, section]);

  useEffect(() => {
    if (!settings) return;
    setSectionBaseline(pickSectionFromSettings(section, settings));
    setServerFieldErrors({});
  }, [section]);

  useEffect(() => {
    if (!settings) return;
    applyBrandTheme(settings.primaryColor, settings.accentColor);
  }, [settings?.primaryColor, settings?.accentColor]);

  function applySavedSettings(next: StoreSettings) {
    const normalized = withEmailNotifyDefaults(next);
    setSettings(normalized);
    setSectionBaseline(pickSectionFromSettings(section, normalized));
  }

  function successMessage(affectsStorefront: boolean) {
    if (affectsStorefront) {
      return `Saved. Customer-facing pages refresh within about ${STOREFRONT_ISR_SECONDS} seconds.`;
    }
    return "Saved. These changes apply to staff tools and reports.";
  }

  async function performSave(confirmDangerous: boolean) {
    if (!settings || !sectionDef.usesSettingsForm) return;
    setSaving(true);
    setMsg("");
    setServerFieldErrors({});
    const patch = pickSectionFromSettings(section, settings);
    const version = settings.version ?? 0;
    try {
      const res = await patchSettingsSection(section, { ...patch, version, confirm: confirmDangerous || undefined });
      applySavedSettings(res.settings);
      const affects =
        res.affectsStorefront ?? STOREFRONT_SETTINGS_SECTIONS.includes(section);
      if (affects) {
        await revalidateStorefront();
        window.dispatchEvent(new Event("store-refresh"));
      }
      setMsg(successMessage(affects));
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        const flat: Record<string, string> = {};
        for (const [key, val] of Object.entries(err.fields)) {
          flat[key] = val.message;
        }
        setServerFieldErrors(flat);
        setMsg(err.message || "Fix the highlighted fields and try again.");
        const firstKey = Object.keys(flat)[0];
        if (firstKey) {
          requestAnimationFrame(() => document.getElementById(`field-${firstKey}`)?.focus());
        }
        return;
      }
      if (isSettingsConflict(err) && err.payload) {
        const diff = (err.payload.diff as SettingsConflictDiff) ?? {};
        const server = err.payload.settings as StoreSettings;
        setConflictDiff(diff);
        setConflictServerSettings(server);
        setConflictOpen(true);
        setMsg("Someone else saved this section first.");
        return;
      }
      if (err instanceof ApiError && err.code === "CONFIRMATION_REQUIRED") {
        const impacts = (err.payload?.impacts as { key: string; text: string }[]) ?? [];
        setDangerousImpacts(impacts);
        setDangerousOpen(true);
        setPendingConfirmSave(true);
        setMsg("Confirm this change before saving.");
        return;
      }
      setMsg(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
      setPendingConfirmSave(false);
    }
  }

  async function onSave(e?: FormEvent) {
    e?.preventDefault();
    if (!settings || !sectionDef.usesSettingsForm) return;
    const impacts = dangerousImpactsForSection(section, settings, sectionBaseline);
    if (impacts.length > 0) {
      setDangerousImpacts(impacts);
      setDangerousOpen(true);
      setPendingConfirmSave(true);
      return;
    }
    await performSave(false);
  }

  function discardSectionChanges() {
    if (!settings) return;
    setSettings({ ...settings, ...sectionBaseline } as StoreSettings);
    setServerFieldErrors({});
    setMsg("");
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

  async function onFaviconUpload(file: File) {
    setFaviconUploading(true);
    setFaviconError("");
    try {
      const { url } = await apiUpload("/upload/image", file);
      setSettings((current) => (current ? { ...current, faviconUrl: url } : current));
    } catch (err) {
      setFaviconError(err instanceof ApiError ? err.message : "Could not upload favicon");
    } finally {
      setFaviconUploading(false);
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

  const sectionPatch = useMemo(
    () => (settings ? pickSectionFromSettings(section, settings) : {}),
    [settings, section]
  );
  const fieldErrors = useMemo(() => {
    const raw = settings ? validateSettingsInput(sectionPatch) : {};
    const flat: Record<string, string> = {};
    for (const [key, val] of Object.entries(raw)) {
      flat[key] = typeof val === "string" ? val : (val as { message: string }).message;
    }
    return { ...flat, ...serverFieldErrors };
  }, [settings, sectionPatch, serverFieldErrors]);
  const invalid = Object.keys(fieldErrors).length > 0;
  const dirtyCount = settings ? countSectionDirtyChanges(section, settings, sectionBaseline) : 0;
  const dirty = dirtyCount > 0;

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

  if (accountSection) {
    return (
      <div className="space-y-6 pb-6" id={`section-${section}`}>
        <SettingsPageHeader title={sectionDef.title} description={sectionDef.description} />
        <MyAccountSettings />
      </div>
    );
  }

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

  if (!settings) return null;

  const closedHint = generatedClosedMessage(settings);
  const usesForm = sectionDef.usesSettingsForm;
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
    <div
      className={`space-y-5 ${
        dirty
          ? "pb-[max(9rem,calc(9rem+env(safe-area-inset-bottom)))] lg:pb-28"
          : "pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:pb-6"
      }`}
      id={`section-${section}`}
    >
      <SettingsPageHeader
        title={sectionDef.title}
        description={sectionDef.description}
        actions={
          sectionDef.usesSettingsForm && user?.role === "ADMIN" ? (
            <button
              type="button"
              className="btn-ghost inline-flex min-h-10 items-center gap-2 text-sm"
              onClick={() => setHistoryOpen(true)}
            >
              <History size={16} aria-hidden />
              History
            </button>
          ) : null
        }
      />
      <AdminScopeBanner variant="chain" />

      {msg && (
        <p
          aria-live="polite"
          className={`rounded-2xl px-4 py-3 text-sm font-medium ${
            msg.includes("failed") || msg.includes("Could not") || msg.includes("Fix the")
              ? "bg-red-50 text-red-800"
              : "bg-emerald-50 text-emerald-800"
          }`}
        >
          {msg}
        </p>
      )}

      <form onSubmit={onSave} className={usesForm ? "space-y-5" : "hidden"}>
        {section === "branding-theme" && (
          <BrandingThemeSettings
            settings={settings}
            fieldErrors={fieldErrors}
            onChange={(patch) => setSettings({ ...settings, ...patch })}
            timezoneChoices={timezoneChoices}
            currencyChoices={currencyChoices}
            activeCurrency={activeCurrency}
            onCurrencyChange={setCurrency}
            logoUploading={logoUploading}
            logoError={logoError}
            onLogoUpload={onLogoUpload}
            faviconUploading={faviconUploading}
            faviconError={faviconError}
            onFaviconUpload={onFaviconUpload}
          />
        )}

        {section === "contact-social" && (
          <ContactSocialSettings
            settings={settings}
            fieldErrors={fieldErrors}
            onChange={(patch) => setSettings({ ...settings, ...patch })}
          />
        )}

        {section === "reviews-testimonials" && (
        <SettingsSection
          icon={Star}
          title="Storefront reviews"
          description="Published testimonials appear on the homepage. Live order stats need at least 10 completed orders."
        >
          <p className="text-xs text-stone-600">
            Google Place ID and API status live under{" "}
            <Link href={settingsPath("integrations")} className="font-semibold text-brand-700 hover:underline">
              Integrations
            </Link>
            .
          </p>
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

        {section === "integrations" && (
          <IntegrationsSettings
            settings={settings}
            fieldErrors={fieldErrors}
            onChange={(patch) => setSettings({ ...settings, ...patch })}
          />
        )}

        {section === "reviews-testimonials" && (
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
          <p className="mt-2 text-xs text-stone-500">Applies immediately — no need to use Save changes.</p>
          <button type="button" className="btn-primary mt-3" onClick={() => void addTestimonial()}>
            <Plus size={16} /> Add testimonial
          </button>
        </SettingsSection>
        )}

        {section === "notifications" && (
          <NotificationsSettings
            settings={settings}
            onChange={(patch) => setSettings({ ...settings, ...patch })}
          />
        )}

        {section === "orders-delivery" && (
          <SettingsSection
            icon={Truck}
            title="Orders & delivery"
            description="Checkout rules and customer-facing time estimates. Late-order highlights use Alert thresholds."
          >
            <p className="text-xs text-stone-500">
              Dashboard and dispatch “late” badges follow{" "}
              <a href="/admin/settings/alert-thresholds" className="font-semibold text-brand-700 hover:text-brand-800">
                Alert thresholds
              </a>
              , not duplicate SLA fields here.
            </p>
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
              <SettingsField
                label="Delivery estimate (min)"
                hint="Shown on the storefront, checkout, and FAQ — not the same as late-delivery alerts."
              >
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={settings.deliveryEstimateMin}
                  onChange={(e) => setSettings({ ...settings, deliveryEstimateMin: Number(e.target.value) })}
                />
              </SettingsField>
              <SettingsField label="Takeaway estimate (min)" hint="Pickup / takeaway ETA shown to customers.">
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={settings.pickupEstimateMin}
                  onChange={(e) => setSettings({ ...settings, pickupEstimateMin: Number(e.target.value) })}
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
          </div>
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

        {section === "tax-receipts" && (
          <TaxReceiptsSettings
            settings={settings}
            fieldErrors={fieldErrors}
            onChange={(patch) => setSettings({ ...settings, ...patch })}
          />
        )}

        {section === "devices-printing" && (
          <DevicesPrintingSettings
            settings={settings}
            fieldErrors={fieldErrors}
            onChange={(patch) => setSettings({ ...settings, ...patch })}
          />
        )}

        {section === "pos-controls-approvals" && (
          <PosControlsApprovalsSettings
            settings={settings}
            fieldErrors={fieldErrors}
            onChange={(patch) => setSettings({ ...settings, ...patch })}
          />
        )}

        {section === "hours-availability" && (
        <SettingsSection
          icon={Clock}
          title="Hours & availability"
          description={`Online ordering follows this schedule (and special days). POS and dine-in use kitchen hours only. Timezone: ${settings.timezone || "restaurant default"}.`}
        >
          <div className="grid gap-6 xl:grid-cols-[auto_minmax(0,1fr)] xl:items-start">
            <OpeningHoursEditor
              settings={settings}
              onChange={(patch) => setSettings({ ...settings, ...patch })}
            />

            <div className="space-y-4">
              <SpecialHoursEditor
                settings={settings}
                onChange={(patch) => setSettings({ ...settings, ...patch })}
              />

              <SettingsField
                label="Last order cutoff (minutes)"
                hint="Stop online orders this many minutes before the kitchen closes for the current slot."
              >
                <input
                  type="number"
                  min={0}
                  max={180}
                  className="input w-full max-w-md"
                  value={settings.lastOrderCutoffMinutes ?? 0}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      lastOrderCutoffMinutes: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                />
              </SettingsField>

              <SettingsField
                label="Closed message"
                hint='Shown when online ordering is closed. Use {opensAt} for the next opening time. Leave blank for an automatic message.'
              >
                <textarea
                  className="input min-h-24 resize-none"
                  value={settings.closedMessage}
                  placeholder={closedHint}
                  onChange={(e) => setSettings({ ...settings, closedMessage: e.target.value })}
                />
              </SettingsField>

              <div
                className={`space-y-3 rounded-2xl border p-4 transition ${
                  settings.forceClosed
                    ? "border-amber-300 bg-amber-50"
                    : "border-stone-200 bg-stone-50"
                }`}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                    checked={settings.forceClosed}
                    onChange={(e) => setSettings({ ...settings, forceClosed: e.target.checked })}
                  />
                  <div>
                    <p className="text-sm font-semibold text-stone-900">Close online ordering</p>
                    <p className="mt-1 text-xs leading-relaxed text-stone-500">
                      Pauses web and app checkout. Kitchen schedule, POS, and dine-in reservations are unchanged.
                    </p>
                  </div>
                </label>

                {settings.forceClosed && (
                  <>
                    <SettingsField label="Reason (optional)" hint="Shown to customers when no custom closed message is set.">
                      <input
                        className="input w-full"
                        value={settings.onlineCloseReason ?? ""}
                        onChange={(e) => setSettings({ ...settings, onlineCloseReason: e.target.value })}
                        placeholder="e.g. Kitchen maintenance today"
                      />
                    </SettingsField>
                    <SettingsField
                      label="Auto-reopen"
                      hint="Leave empty to stay closed until you turn this off."
                    >
                      <input
                        type="datetime-local"
                        className="input w-full max-w-sm"
                        value={
                          settings.onlineReopenAt
                            ? new Date(settings.onlineReopenAt).toISOString().slice(0, 16)
                            : ""
                        }
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            onlineReopenAt: e.target.value
                              ? new Date(e.target.value).toISOString()
                              : null,
                          })
                        }
                      />
                    </SettingsField>
                  </>
                )}

                {settings.forceClosed && settings.onlineClosedAt && (
                  <p className="text-xs text-stone-600">
                    Closed{" "}
                    {new Date(settings.onlineClosedAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                    {settings.onlineClosedByName || settings.onlineClosedByUserId
                      ? ` by ${settings.onlineClosedByName ?? "staff"}`
                      : ""}
                    .
                  </p>
                )}
              </div>
            </div>
          </div>
        </SettingsSection>
        )}

      </form>

      {section === "alert-thresholds" && settings && (
        <AlertThresholdsSettings
          settings={settings}
          onChange={(patch) => setSettings({ ...settings, ...patch })}
        />
      )}

      {section === "scheduled-reports" && settings && (
        <ScheduledReportsSettings
          settings={settings}
          onChange={(patch) => setSettings({ ...settings, ...patch })}
          testing={analyticsEmailTesting}
          onTestingChange={setAnalyticsEmailTesting}
          onMessage={setMsg}
        />
      )}

      {section === "costing" && settings && (
        <CostingSettings
          settings={settings}
          fieldErrors={fieldErrors}
          onChange={(patch) => setSettings({ ...settings, ...patch })}
        />
      )}

      {section === "inventory" && settings && (
        <InventoryMenuSettings
          settings={settings}
          onChange={(patch) => setSettings({ ...settings, ...patch })}
        />
      )}

      {section === "banners" && (
        <BannersSettings
          banners={banners}
          form={bannerForm}
          onFormChange={(patch) => setBannerForm({ ...bannerForm, ...patch })}
          uploading={uploading}
          error={bannerError}
          onUpload={onBannerUpload}
          onAdd={() => void addBanner()}
          onToggle={(b) => void toggleBanner(b)}
          onPinFirst={(b) => void pinBannerFirst(b)}
          onRequestDelete={requestRemoveBanner}
        />
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

      <SettingsSaveBar
        changeCount={dirtyCount}
        saving={saving}
        disabled={invalid}
        onSave={() => void onSave()}
        onDiscard={discardSectionChanges}
      />

      <SettingsDangerousConfirmSheet
        open={dangerousOpen}
        impacts={dangerousImpacts}
        saving={saving}
        onClose={() => {
          setDangerousOpen(false);
          setPendingConfirmSave(false);
        }}
        onConfirm={() => {
          setDangerousOpen(false);
          void performSave(true);
        }}
      />

      <SettingsHistoryDrawer
        open={historyOpen}
        sectionId={section}
        onClose={() => setHistoryOpen(false)}
        onRestore={(entry) => {
          if (!settings) return;
          void (async () => {
            try {
              const res = await restoreSettingsFromHistory(section, entry.id, settings.version ?? 0, true);
              applySavedSettings(res.settings);
              setHistoryOpen(false);
              setMsg("Restored previous values.");
            } catch (err) {
              setMsg(err instanceof Error ? err.message : "Could not restore.");
            }
          })();
        }}
      />

      <SettingsConflictSheet
        open={conflictOpen}
        diff={conflictDiff}
        onClose={() => setConflictOpen(false)}
        onReload={() => {
          if (conflictServerSettings) applySavedSettings(conflictServerSettings);
          setConflictOpen(false);
          setMsg("Reloaded the latest saved version.");
        }}
        onKeepMine={() => {
          if (conflictServerSettings) {
            setSettings((current) =>
              current ? { ...current, version: conflictServerSettings.version ?? current.version } : current
            );
          }
          setConflictOpen(false);
        }}
      />
    </div>
  );
}
