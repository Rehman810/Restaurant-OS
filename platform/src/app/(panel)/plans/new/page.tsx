"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { usePlatformAuth } from "@/lib/auth";
import { ForbiddenPage } from "@/components/RequirePermission";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { PanelCard } from "@/components/PanelCard";
import {
  DEFAULT_ENTITLEMENTS_FORM,
  PlanEntitlementsFields,
  entitlementsToApi,
  type EntitlementsForm,
} from "@/components/PlanEntitlementsFields";

export default function NewPlanPage() {
  const router = useRouter();
  const { can } = usePlatformAuth();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [entitlements, setEntitlements] = useState<EntitlementsForm>(DEFAULT_ENTITLEMENTS_FORM);

  if (!can("plans:write")) return <ForbiddenPage />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await api<{ plan: { id: string } }>("/plans", {
        method: "POST",
        body: JSON.stringify({
          slug: String(form.get("slug") || ""),
          name: String(form.get("name") || ""),
          description: String(form.get("description") || ""),
          interval: String(form.get("interval") || "MONTHLY"),
          pricePkr: Number(form.get("pricePkr") || 0),
          sortOrder: Number(form.get("sortOrder") || 0),
          isActive: form.get("isActive") === "on",
          entitlements: entitlementsToApi(entitlements),
        }),
      });
      router.push(`/plans/${res.plan.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create plan.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <BackLink href="/plans" label="Plans" />
      <PageHeader eyebrow="Catalog" title="New plan" description="Defines license tier and included modules for tenants" />
      <PanelCard>
        <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              <span className="field-label">Display name</span>
              <input name="name" className="input" required />
            </label>
            <label className="text-sm">
              <span className="field-label">Slug</span>
              <input name="slug" className="input" required pattern="[a-z0-9-]{2,}" placeholder="pro" />
            </label>
            <label className="text-sm">
              <span className="field-label">Sort order</span>
              <input name="sortOrder" type="number" className="input" defaultValue={0} />
            </label>
            <label className="text-sm">
              <span className="field-label">Price (PKR)</span>
              <input name="pricePkr" type="number" className="input" min={0} required defaultValue={0} />
            </label>
            <label className="text-sm">
              <span className="field-label">Billing interval</span>
              <select name="interval" className="input" defaultValue="MONTHLY">
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="field-label">Description</span>
              <textarea name="description" className="input min-h-[72px]" />
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm sm:col-span-2">
              <input name="isActive" type="checkbox" defaultChecked className="h-4 w-4 rounded" />
              Active (available for new subscriptions)
            </label>
          </div>
          <PlanEntitlementsFields value={entitlements} onChange={setEntitlements} />
          {error ? <p className="flash-error">{error}</p> : null}
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Creating…" : "Create plan"}
          </button>
        </form>
      </PanelCard>
    </div>
  );
}
