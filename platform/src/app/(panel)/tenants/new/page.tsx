"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { usePlatformAuth } from "@/lib/auth";
import { ForbiddenPage } from "@/components/RequirePermission";
import { tenantStorefrontUrl } from "@/lib/tenant-url";
import { CURRENCY_OPTIONS, TIMEZONE_OPTIONS } from "@/lib/locale-options";
import { slugFromDisplayName } from "@/lib/tenant-slug";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { PanelCard } from "@/components/PanelCard";

function SectionTitle({ children }: { children: string }) {
  return <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{children}</p>;
}

export default function CreateTenantPage() {
  const router = useRouter();
  const { can } = usePlatformAuth();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [currencyCode, setCurrencyCode] = useState("PKR");
  const [trialDays, setTrialDays] = useState(15);
  const [postTrialPlanSlug, setPostTrialPlanSlug] = useState("growth");

  const currencySymbol = useMemo(
    () => CURRENCY_OPTIONS.find((c) => c.code === currencyCode)?.symbol || "Rs",
    [currencyCode]
  );

  const previewUrl = useMemo(() => {
    const s = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (s.length < 2) return "";
    return tenantStorefrontUrl(s, `${s}.localhost`);
  }, [slug]);

  useEffect(() => {
    if (slugTouched) return;
    const next = slugFromDisplayName(displayName);
    if (next.length >= 2) setSlug(next);
    else setSlug("");
  }, [displayName, slugTouched]);

  useEffect(() => {
    void api<{ data: Record<string, unknown> }>("/settings")
      .then((res) => {
        setTrialDays(Number(res.data.trialDays ?? 15));
        setPostTrialPlanSlug(String(res.data.defaultPlanSlug || "growth"));
      })
      .catch(() => null);
  }, []);

  if (!can("tenants:write")) {
    return <ForbiddenPage />;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    const slugVal = String(form.get("slug") || "").trim().toLowerCase();
    const body: Record<string, unknown> = {
      slug: slugVal,
      displayName: String(form.get("displayName") || ""),
      legalName: String(form.get("legalName") || ""),
      storeTagline: String(form.get("storeTagline") || ""),
      timezone: String(form.get("timezone") || "Asia/Karachi"),
      currencyCode: String(form.get("currencyCode") || "PKR"),
      currencySymbol: String(form.get("currencySymbol") || currencySymbol),
      city: String(form.get("city") || ""),
      address: String(form.get("address") || ""),
      branchArea: String(form.get("branchArea") || ""),
      storePhone: String(form.get("storePhone") || ""),
      whatsapp: String(form.get("whatsapp") || ""),
      latitude: String(form.get("latitude") || ""),
      longitude: String(form.get("longitude") || ""),
      minimumOrder: String(form.get("minimumOrder") || ""),
      taxEnabled: form.get("taxEnabled") === "on",
      taxPercent: String(form.get("taxPercent") || ""),
      planSlug: postTrialPlanSlug,
      trialDays,
      ownerName: String(form.get("ownerName") || ""),
      ownerEmail: String(form.get("ownerEmail") || ""),
      ownerPhone: String(form.get("ownerPhone") || ""),
      ownerPassword: String(form.get("ownerPassword") || ""),
      acceptsOnlineOrders: form.get("acceptsOnlineOrders") === "on",
      seedDeliveryAreas: form.get("seedDeliveryAreas") === "on",
      seedStarterMenu: form.get("seedStarterMenu") === "on",
      isTest: form.get("isTest") === "on",
      hostname: slugVal ? `${slugVal}.localhost` : null,
    };
    try {
      const res = await api<{ tenant: { id: string } }>("/tenants", {
        method: "POST",
        body: JSON.stringify(body),
      });
      router.push(`/tenants/${res.tenant.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create tenant.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <BackLink href="/tenants" label="Tenants" />
      <PageHeader
        eyebrow="Provision"
        title="Create tenant"
        description={`${trialDays}-day full-access trial (from platform settings), then billing on the default plan. Store URL slug is generated from the restaurant name.`}
      />
      <PanelCard>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-4">
            <SectionTitle>Store identity</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm sm:col-span-2">
                <span className="field-label">Display name</span>
                <input
                  name="displayName"
                  className="input"
                  required
                  placeholder="Ubaid Fast Foodz"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="field-label">Legal name (receipts)</span>
                <input name="legalName" className="input" placeholder="Same as display name if blank" />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="field-label">Store tagline</span>
                <input name="storeTagline" className="input" placeholder="Order in minutes" />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="field-label">URL slug</span>
                <input
                  name="slug"
                  className="input"
                  required
                  pattern="[a-z0-9-]{2,}"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value);
                  }}
                />
                <span className="mt-1 block text-xs text-slate-500">
                  Auto-filled from the restaurant name. This is the store link path — not a separate “hostname” field.
                  {previewUrl ? ` Dev storefront: ${previewUrl}` : ""}
                </span>
              </label>
              <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm sm:col-span-2 dark:border-sky-400/20 dark:bg-sky-950/40">
                <p className="font-semibold text-sky-900 dark:text-sky-100">{trialDays}-day free trial</p>
                <p className="mt-1 text-xs leading-relaxed text-sky-900/80 dark:text-sky-100/80">
                  All admin modules (POS, kitchen, inventory, analytics, etc.) are enabled during the trial. After{" "}
                  {trialDays} days, billing moves to the <strong>{postTrialPlanSlug}</strong> plan (change defaults under
                  System → Settings). No plan picker here — trial first, plan later.
                </p>
              </div>
            </div>
          </div>

          <hr className="border-slate-200 dark:border-white/10" />

          <div className="space-y-4">
            <SectionTitle>Location and contact</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className="field-label">City</span>
                <input name="city" className="input" defaultValue="Karachi" required />
              </label>
              <label className="text-sm">
                <span className="field-label">Area / neighbourhood</span>
                <input name="branchArea" className="input" placeholder="DHA Phase 5" />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="field-label">Street address</span>
                <input name="address" className="input" placeholder="Plot 12, Main Boulevard" />
              </label>
              <label className="text-sm">
                <span className="field-label">Store phone</span>
                <input name="storePhone" className="input" placeholder="0300-1234567" />
              </label>
              <label className="text-sm">
                <span className="field-label">WhatsApp</span>
                <input name="whatsapp" className="input" placeholder="Same as store phone" />
              </label>
              <label className="text-sm">
                <span className="field-label">Latitude (optional)</span>
                <input name="latitude" type="number" step="any" className="input" />
              </label>
              <label className="text-sm">
                <span className="field-label">Longitude (optional)</span>
                <input name="longitude" type="number" step="any" className="input" />
              </label>
            </div>
          </div>

          <hr className="border-slate-200 dark:border-white/10" />

          <div className="space-y-4">
            <SectionTitle>Locale and orders</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className="field-label">Timezone</span>
                <select name="timezone" className="input" defaultValue="Asia/Karachi">
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="field-label">Currency</span>
                <select
                  name="currencyCode"
                  className="input"
                  value={currencyCode}
                  onChange={(e) => setCurrencyCode(e.target.value)}
                >
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                  ))}
                </select>
                <input type="hidden" name="currencySymbol" value={currencySymbol} />
              </label>
              <label className="text-sm">
                <span className="field-label">Minimum order (PKR)</span>
                <input name="minimumOrder" type="number" className="input" defaultValue={500} min={0} />
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input name="acceptsOnlineOrders" type="checkbox" className="h-4 w-4 rounded border-slate-400" defaultChecked />
                <span>Main branch accepts online orders</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input name="taxEnabled" type="checkbox" className="h-4 w-4 rounded border-slate-400" />
                <span>Enable tax</span>
              </label>
              <label className="text-sm">
                <span className="field-label">Tax %</span>
                <input name="taxPercent" type="number" className="input" defaultValue={0} min={0} max={100} step="0.01" />
              </label>
            </div>
          </div>

          <hr className="border-slate-200 dark:border-white/10" />

          <div className="space-y-3">
            <SectionTitle>Starter data</SectionTitle>
            <p className="text-xs text-slate-500">
              Default hours: 12:00–01:30 daily. Karachi gets full area list; other cities get six starter zones.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input name="seedDeliveryAreas" type="checkbox" className="h-4 w-4 rounded border-slate-400" defaultChecked />
              <span>Seed delivery areas for city</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input name="seedStarterMenu" type="checkbox" className="h-4 w-4 rounded border-slate-400" defaultChecked />
              <span>Seed starter menu (burgers, sides, drinks)</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input name="isTest" type="checkbox" className="h-4 w-4 rounded border-slate-400" />
              <span>Mark as test / demo tenant (excluded from KPIs)</span>
            </label>
          </div>

          <hr className="border-slate-200 dark:border-white/10" />

          <div className="space-y-4">
            <SectionTitle>Owner login</SectionTitle>
            <p className="text-xs text-slate-500">Required so the restaurant can sign in to admin immediately.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className="field-label">Name</span>
                <input name="ownerName" className="input" required />
              </label>
              <label className="text-sm">
                <span className="field-label">Email</span>
                <input name="ownerEmail" type="email" className="input" required />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="field-label">Temporary password</span>
                <input name="ownerPassword" type="password" className="input" minLength={12} required />
                <span className="mt-1 block text-xs text-slate-500">Min 12 characters. Share securely.</span>
              </label>
              <label className="text-sm">
                <span className="field-label">Phone</span>
                <input name="ownerPhone" className="input" />
              </label>
            </div>
          </div>

          {error ? <p className="flash-error">{error}</p> : null}
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Creating…" : "Create tenant"}
          </button>
        </form>
      </PanelCard>
    </div>
  );
}
