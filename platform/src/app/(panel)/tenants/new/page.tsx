"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { usePlatformAuth } from "@/lib/auth";
import { ForbiddenPage } from "@/components/RequirePermission";
import { tenantStorefrontUrl } from "@/lib/tenant-url";

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
      <div>
        <Link href="/tenants" className="text-sm text-accent-600 hover:underline">← Tenants</Link>
        <h1 className="mt-2 text-2xl font-semibold">Create tenant</h1>
        <p className="text-sm text-slate-500">Store, branch, trial subscription, local hostname, and optional owner login.</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            Display name
            <input name="displayName" className="input mt-1" required />
          </label>
          <label className="text-sm">
            URL slug
            <input
              name="slug"
              className="input mt-1"
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
            Trial days
            <input name="trialDays" type="number" className="input mt-1" defaultValue={14} min={0} max={90} />
          </label>
          <label className="text-sm sm:col-span-2">
            Plan
            <select name="planSlug" className="input mt-1" defaultValue={defaultPlan}>
              {plans.length === 0 ? <option value="growth">growth</option> : null}
              {plans.map((p) => (
                <option key={p.id} value={p.slug}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            City
            <input name="city" className="input mt-1" />
          </label>
        </div>
        <hr className="border-slate-200 dark:border-slate-800" />
        <p className="text-sm font-medium">Owner (recommended)</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Name
            <input name="ownerName" className="input mt-1" />
          </label>
          <label className="text-sm">
            Email
            <input name="ownerEmail" type="email" className="input mt-1" />
          </label>
          <label className="text-sm sm:col-span-2">
            Temporary password
            <input name="ownerPassword" type="password" className="input mt-1" minLength={12} />
            <span className="mt-1 block text-xs text-slate-500">Min 12 characters. Share securely.</span>
          </label>
          <label className="text-sm">
            Phone
            <input name="ownerPhone" className="input mt-1" />
          </label>
        </div>
        {error ? <p className="text-sm text-rose-500">{error}</p> : null}
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "Creating…" : "Create tenant"}
        </button>
      </form>
    </div>
  );
}
