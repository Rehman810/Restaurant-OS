"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { usePlatformAuth } from "@/lib/auth";
import { formatPkr } from "@/lib/format";
import { ForbiddenPage } from "@/components/RequirePermission";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { PanelCard } from "@/components/PanelCard";
import {
  PlanEntitlementsFields,
  entitlementsFromApi,
  entitlementsToApi,
  type EntitlementsForm,
} from "@/components/PlanEntitlementsFields";

type PlanDetail = {
  id: string;
  slug: string;
  name: string;
  description: string;
  interval: string;
  pricePkr: number;
  isActive: boolean;
  sortOrder: number;
  entitlements: Record<string, unknown>;
  subscriberCount: number;
};

export default function PlanDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const { can } = usePlatformAuth();
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [entitlements, setEntitlements] = useState<EntitlementsForm | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void api<{ plan: PlanDetail }>(`/plans/${id}`)
      .then((r) => {
        setPlan(r.plan);
        setEntitlements(entitlementsFromApi(r.plan.entitlements));
      })
      .catch(() => setError("Could not load plan."));
  }, [id]);

  if (!can("plans:read")) return <ForbiddenPage />;
  if (error) return <p className="flash-error">{error}</p>;
  if (!plan || !entitlements) return <div className="h-48 animate-pulse rounded-2xl bg-white/5" />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!can("plans:write") || !entitlements) return;
    setMessage("");
    const form = new FormData(e.currentTarget);
    const ent = entitlements;
    try {
      await api(`/plans/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          slug: String(form.get("slug") || ""),
          name: String(form.get("name") || ""),
          description: String(form.get("description") || ""),
          interval: String(form.get("interval") || "MONTHLY"),
          pricePkr: Number(form.get("pricePkr") || 0),
          sortOrder: Number(form.get("sortOrder") || 0),
          isActive: form.get("isActive") === "on",
          entitlements: entitlementsToApi(ent),
        }),
      });
      setMessage("Plan saved. Existing tenants on this plan pick up new modules on next request.");
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Save failed.");
    }
  }

  return (
    <div className="space-y-6">
      <BackLink href="/plans" label="Plans" />
      <PageHeader
        eyebrow="Catalog"
        title={plan.name}
        description={`${plan.subscriberCount} tenant(s) subscribed · ${formatPkr(plan.pricePkr)} / ${plan.interval === "YEARLY" ? "year" : "month"}`}
      />

      {message ? <p className="flash-ok">{message}</p> : null}

      <PanelCard title="Plan details">
        {can("plans:write") ? (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm sm:col-span-2">
                <span className="field-label">Display name</span>
                <input name="name" className="input" required defaultValue={plan.name} />
              </label>
              <label className="text-sm">
                <span className="field-label">Slug</span>
                <input name="slug" className="input" required pattern="[a-z0-9-]{2,}" defaultValue={plan.slug} />
              </label>
              <label className="text-sm">
                <span className="field-label">Sort order</span>
                <input name="sortOrder" type="number" className="input" defaultValue={plan.sortOrder} />
              </label>
              <label className="text-sm">
                <span className="field-label">Price (PKR)</span>
                <input name="pricePkr" type="number" className="input" min={0} required defaultValue={plan.pricePkr} />
              </label>
              <label className="text-sm">
                <span className="field-label">Billing interval</span>
                <select name="interval" className="input" defaultValue={plan.interval}>
                  <option value="MONTHLY">Monthly</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="field-label">Description</span>
                <textarea name="description" className="input min-h-[72px]" defaultValue={plan.description} />
              </label>
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm sm:col-span-2">
                <input name="isActive" type="checkbox" defaultChecked={plan.isActive} className="h-4 w-4 rounded" />
                Active
              </label>
            </div>
            <PlanEntitlementsFields value={entitlements} onChange={setEntitlements} />
            <button type="submit" className="btn-primary">Save plan</button>
          </form>
        ) : (
          <p className="text-sm text-slate-500">Read-only for your role.</p>
        )}
      </PanelCard>
    </div>
  );
}
