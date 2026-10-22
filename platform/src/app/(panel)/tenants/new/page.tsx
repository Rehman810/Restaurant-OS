"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { usePlatformAuth } from "@/lib/auth";
import { ForbiddenPage } from "@/components/RequirePermission";
import { tenantStorefrontUrl } from "@/lib/tenant-url";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { PanelCard } from "@/components/PanelCard";

type Plan = { id: string; name: string; slug: string };

export default function CreateTenantPage() {
  const router = useRouter();
  const { can } = usePlatformAuth();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [slug, setSlug] = useState("");

  const previewUrl = useMemo(() => {
    const s = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (s.length < 2) return "";
    return tenantStorefrontUrl(s, `${s}.localhost`);
  }, [slug]);

  useEffect(() => {
    void api<{ plans: Plan[] }>("/plans")
      .then((r) => setPlans(r.plans))
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
    const slugVal = String(form.get("slug") || "").trim();
    const body = {
      slug: slugVal,
      displayName: String(form.get("displayName") || ""),
      ownerName: String(form.get("ownerName") || ""),
      ownerEmail: String(form.get("ownerEmail") || ""),
      ownerPhone: String(form.get("ownerPhone") || ""),
      city: String(form.get("city") || ""),
      planSlug: String(form.get("planSlug") || "growth"),
      trialDays: Number(form.get("trialDays") || 14),
      ownerPassword: String(form.get("ownerPassword") || ""),
      hostname: `${slugVal.toLowerCase()}.localhost`,
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

  const defaultPlan = plans.find((p) => p.slug === "growth")?.slug || plans[0]?.slug || "growth";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink href="/tenants" label="Tenants" />
      <PageHeader
        eyebrow="Provision"
        title="Create tenant"
        description="Store, branch, trial subscription, local hostname, and optional owner login."
      />
      <PanelCard>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            <span className="field-label">Display name</span>
            <input name="displayName" className="input" required />
          </label>
          <label className="text-sm">
            <span className="field-label">URL slug</span>
            <input
              name="slug"
              className="input"
              required
              pattern="[a-z0-9-]{2,}"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
            {previewUrl ? (
              <span className="mt-1 block text-xs text-slate-500">Local store: {previewUrl}</span>
            ) : null}
          </label>
          <label className="text-sm">
            <span className="field-label">Trial days</span>
            <input name="trialDays" type="number" className="input" defaultValue={14} min={0} max={90} />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="field-label">Plan</span>
            <select name="planSlug" className="input" defaultValue={defaultPlan}>
              {plans.length === 0 ? <option value="growth">growth</option> : null}
              {plans.map((p) => (
                <option key={p.id} value={p.slug}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="field-label">City</span>
            <input name="city" className="input" />
          </label>
        </div>
        <hr className="border-slate-200 dark:border-white/10" />
        <p className="text-sm font-semibold">Owner (recommended)</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="field-label">Name</span>
            <input name="ownerName" className="input" />
          </label>
          <label className="text-sm">
            <span className="field-label">Email</span>
            <input name="ownerEmail" type="email" className="input" />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="field-label">Temporary password</span>
            <input name="ownerPassword" type="password" className="input" minLength={12} />
            <span className="mt-1 block text-xs text-slate-500">Min 12 characters. Share securely.</span>
          </label>
          <label className="text-sm">
            <span className="field-label">Phone</span>
            <input name="ownerPhone" className="input" />
          </label>
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
