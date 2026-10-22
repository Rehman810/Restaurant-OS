"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink } from "lucide-react";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { usePlatformAuth } from "@/lib/auth";
import { formatPktDate } from "@/lib/format";
import { tenantAdminUrl, tenantStorefrontUrl } from "@/lib/tenant-url";
import { PageHeader } from "@/components/PageHeader";
import { PanelCard } from "@/components/PanelCard";
import { StatusBadge } from "@/components/StatusBadge";
import { TenantInvoicesSection } from "@/components/TenantInvoicesSection";

type Plan = { id: string; name: string; slug: string };
type TenantDetail = {
  id: string;
  slug: string;
  displayName: string;
  hostname: string | null;
  status: string;
  statusReason: string;
  ownerEmail: string;
  ownerName: string;
  ownerPhone: string;
  city: string;
  createdAt: string;
  deleteScheduledAt: string | null;
  subscription?: {
    id: string;
    status: string;
    planId: string;
    plan: Plan;
    trialEndsAt: string | null;
    currentPeriodEnd: string;
  } | null;
  domains?: Array<{ id: string; hostname: string }>;
  notes?: Array<{ id: string; body: string; createdAt: string }>;
};

type Health = { score: number; factors: Array<{ id: string; label: string; impact: number }> };

type Invoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  amountPkr: number;
  dueAt: string;
  paidAt: string | null;
};

const LIFECYCLE = ["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED"] as const;

export default function TenantDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const { can } = usePlatformAuth();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [profile, setProfile] = useState({ displayName: "", ownerName: "", ownerEmail: "", ownerPhone: "", city: "", hostname: "" });
  const [statusReason, setStatusReason] = useState("");
  const [planId, setPlanId] = useState("");
  const [noteText, setNoteText] = useState("");
  const [supportToken, setSupportToken] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function reload() {
    void api<{ tenant: TenantDetail }>(`/tenants/${id}`)
      .then((t) => {
        setTenant(t.tenant);
        setProfile({
          displayName: t.tenant.displayName || "",
          ownerName: t.tenant.ownerName || "",
          ownerEmail: t.tenant.ownerEmail || "",
          ownerPhone: t.tenant.ownerPhone || "",
          city: t.tenant.city || "",
          hostname: t.tenant.hostname || "",
        });
        setPlanId(t.tenant.subscription?.planId || "");
      })
      .catch(() => setError("Could not load tenant."));
    void api<Health>(`/tenants/${id}/health`).then(setHealth).catch(() => undefined);
    if (can("plans:read")) {
      void api<{ plans: Plan[] }>("/plans").then((r) => setPlans(r.plans)).catch(() => undefined);
    }
    reloadInvoices();
  }

  function reloadInvoices() {
    if (!can("billing:read")) return;
    void api<{ invoices: Invoice[] }>(`/invoices?restaurantId=${encodeURIComponent(id)}`)
      .then((r) => setInvoices(r.invoices))
      .catch(() => undefined);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- id + permission gates
  }, [id]);

  async function saveProfile() {
    if (!can("tenants:write")) return;
    setMessage("");
    try {
      await api(`/tenants/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          displayName: profile.displayName.trim(),
          ownerName: profile.ownerName.trim(),
          ownerEmail: profile.ownerEmail.trim(),
          ownerPhone: profile.ownerPhone.trim(),
          city: profile.city.trim(),
          hostname: profile.hostname.trim() || null,
        }),
      });
      setMessage("Profile saved.");
      reload();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Save failed.");
    }
  }

  async function patchStatus(status: string) {
    if (!can("tenants:write")) return;
    setMessage("");
    try {
      await api(`/tenants/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, statusReason: statusReason.trim() || undefined }),
      });
      setMessage(`Status set to ${status}.`);
      reload();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Update failed.");
    }
  }

  async function savePlan() {
    if (!can("tenants:write") || !planId) return;
    setMessage("");
    try {
      await api(`/tenants/${id}/subscription`, {
        method: "PATCH",
        body: JSON.stringify({ planId }),
      });
      setMessage("Subscription plan updated.");
      reload();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Plan update failed.");
    }
  }

  async function addNote() {
    if (!can("notes:write") || !noteText.trim()) return;
    setMessage("");
    try {
      await api(`/tenants/${id}/notes`, {
        method: "POST",
        body: JSON.stringify({ body: noteText.trim() }),
      });
      setNoteText("");
      setMessage("Note added.");
      reload();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not add note.");
    }
  }

  async function startSupport() {
    if (!can("support:write")) return;
    setMessage("");
    setSupportToken("");
    try {
      const res = await api<{ token: string; expiresAt: string }>(`/tenants/${id}/support-sessions`, {
        method: "POST",
        body: JSON.stringify({ ttlHours: 2 }),
      });
      setSupportToken(res.token);
      setMessage(`Support token issued (expires ${formatPktDate(res.expiresAt)}).`);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not start support session.");
    }
  }

  function copyText(text: string) {
    void navigator.clipboard.writeText(text);
    setMessage("Copied to clipboard.");
  }

  if (error) return <p className="text-rose-500">{error}</p>;
  if (!tenant) return <div className="h-48 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />;

  const storeUrl = tenantStorefrontUrl(tenant.slug, tenant.hostname);
  const adminUrl = tenantAdminUrl(tenant.slug, tenant.hostname);

  return (
    <div className="space-y-6">
      <Link href="/tenants" className="text-sm text-accent-600 hover:underline">← Tenants</Link>
      <PageHeader
        title={tenant.displayName}
        description={`${tenant.slug} · ${tenant.hostname || `${tenant.slug}.localhost`}`}
      >
        <StatusBadge status={tenant.status} />
        {can("audit:read") ? (
          <Link href={`/audit?tenantId=${id}`} className="btn-secondary text-sm">Audit</Link>
        ) : null}
        <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary gap-1 text-sm">
          Store
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <a href={adminUrl} target="_blank" rel="noopener noreferrer" className="btn-primary gap-1 text-sm">
          Admin
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </PageHeader>

      {message ? (
        <p className="rounded-xl border border-accent-200 bg-accent-50 px-4 py-2 text-sm text-accent-800 dark:border-accent-800 dark:bg-accent-950/30 dark:text-accent-100">
          {message}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <h2 className="font-semibold">Profile</h2>
          {can("tenants:write") ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm sm:col-span-2">
                Display name
                <input className="input mt-1" value={profile.displayName} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} />
              </label>
              <label className="text-sm">
                Owner name
                <input className="input mt-1" value={profile.ownerName} onChange={(e) => setProfile({ ...profile, ownerName: e.target.value })} />
              </label>
              <label className="text-sm">
                Owner email
                <input className="input mt-1" type="email" value={profile.ownerEmail} onChange={(e) => setProfile({ ...profile, ownerEmail: e.target.value })} />
              </label>
              <label className="text-sm">
                Phone
                <input className="input mt-1" value={profile.ownerPhone} onChange={(e) => setProfile({ ...profile, ownerPhone: e.target.value })} />
              </label>
              <label className="text-sm">
                City
                <input className="input mt-1" value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} />
              </label>
              <label className="text-sm sm:col-span-2">
                Hostname
                <input className="input mt-1 font-mono text-xs" placeholder={`${tenant.slug}.localhost`} value={profile.hostname} onChange={(e) => setProfile({ ...profile, hostname: e.target.value })} />
              </label>
              <button type="button" className="btn-primary sm:col-span-2" onClick={() => void saveProfile()}>
                Save profile
              </button>
            </div>
          ) : (
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-500">Owner</dt><dd>{tenant.ownerName || "—"}</dd></div>
              <div><dt className="text-slate-500">Email</dt><dd>{tenant.ownerEmail || "—"}</dd></div>
              <div><dt className="text-slate-500">Hostname</dt><dd className="font-mono text-xs">{tenant.hostname || "—"}</dd></div>
              <div><dt className="text-slate-500">Created</dt><dd>{formatPktDate(tenant.createdAt)}</dd></div>
            </dl>
          )}
          {tenant.deleteScheduledAt ? (
            <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
              Delete scheduled: {formatPktDate(tenant.deleteScheduledAt)}
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-semibold">Health</h2>
          <p className="mt-2 text-3xl font-semibold">{health?.score ?? "—"}</p>
          <ul className="mt-3 space-y-1 text-xs text-slate-500">
            {health?.factors.map((f) => (
              <li key={f.id}>{f.label}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-semibold">Subscription</h2>
        {tenant.subscription ? (
          <p className="mt-2 text-sm">
            <strong>{tenant.subscription.plan.name}</strong> · {tenant.subscription.status}
            {tenant.subscription.trialEndsAt ? (
              <span className="text-slate-500"> · trial ends {formatPktDate(tenant.subscription.trialEndsAt)}</span>
            ) : null}
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No subscription row.</p>
        )}
        {can("tenants:write") && plans.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-sm">
              Change plan
              <select className="input mt-1 min-w-[12rem]" value={planId} onChange={(e) => setPlanId(e.target.value)}>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <button type="button" className="btn-secondary" onClick={() => void savePlan()}>Update plan</button>
          </div>
        ) : null}
      </section>

      {can("billing:read") ? <TenantInvoicesSection invoices={invoices} onRefresh={reloadInvoices} /> : null}

      {(tenant.domains?.length ?? 0) > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-semibold">Custom domains</h2>
          <ul className="mt-2 text-sm">
            {tenant.domains?.map((d) => (
              <li key={d.id} className="font-mono text-xs">{d.hostname}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-semibold">Internal notes</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(tenant.notes ?? []).length === 0 ? (
            <li className="text-slate-500">No notes yet.</li>
          ) : (
            tenant.notes?.map((n) => (
              <li key={n.id} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
                <p>{n.body}</p>
                <p className="mt-1 text-xs text-slate-400">{formatPktDate(n.createdAt)}</p>
              </li>
            ))
          )}
        </ul>
        {can("notes:write") ? (
          <div className="mt-3 flex gap-2">
            <input className="input" placeholder="Add a note…" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
            <button type="button" className="btn-secondary shrink-0" onClick={() => void addNote()}>Add</button>
          </div>
        ) : null}
      </section>

      {can("tenants:write") || can("support:write") ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-semibold">Lifecycle &amp; support</h2>
          {can("tenants:write") ? (
            <>
              <label className="mt-3 block text-sm">
                Reason for status change
                <input className="input mt-1" value={statusReason} onChange={(e) => setStatusReason(e.target.value)} />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                {LIFECYCLE.map((s) => (
                  <button key={s} type="button" className="btn-secondary text-xs" onClick={() => void patchStatus(s)}>
                    {s.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </>
          ) : null}
          {can("support:write") ? (
            <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
              <p className="text-sm text-slate-500">One-time token for support login on the tenant host.</p>
              <button type="button" className="btn-primary mt-2" onClick={() => void startSupport()}>
                Issue support token
              </button>
              {supportToken ? (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
                  <code className="flex-1 truncate text-xs">{supportToken}</code>
                  <button type="button" className="btn-secondary p-2" onClick={() => copyText(supportToken)} aria-label="Copy token">
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
