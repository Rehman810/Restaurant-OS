"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink } from "lucide-react";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { usePlatformAuth } from "@/lib/auth";
import { formatPktDate } from "@/lib/format";
import { tenantAdminUrl, tenantStorefrontUrl } from "@/lib/tenant-url";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { PanelCard } from "@/components/PanelCard";
import { StatusBadge } from "@/components/StatusBadge";
import { TenantInvoicesSection } from "@/components/TenantInvoicesSection";

type Plan = { id: string; name: string; slug: string };
type TenantDetail = {
  id: string;
  slug: string;
  displayName: string;
  isTest?: boolean;
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
    currentPeriodStart: string;
    currentPeriodEnd: string;
  } | null;
  subscriptionTimeline?: {
    phase: string;
    intervalLabel: string;
    trialTotalDays: number | null;
    trialDaysRemaining: number | null;
    trialEndsAt: string | null;
    periodEnd: string;
    periodDaysRemaining: number;
    headline: string;
    detail: string;
    urgency: string;
    adminReadOnly: boolean;
  } | null;
  tenantAccess?: { status: string; statusReason: string } | null;
  domains?: Array<{ id: string; hostname: string; verifiedAt?: string | null }>;
  tags?: string[];
  notes?: Array<{ id: string; body: string; createdAt: string }>;
};

type Health = { score: number; factors: Array<{ id: string; label: string; impact: number }> };

type UsageSummary = {
  tags: string[];
  lastActiveAt: string | null;
  domains: Array<{ id: string; hostname: string; status: string }>;
  limits: { maxBranches: number | null; maxStaff: number | null };
  usage: { branches: number; staff: number; ordersLast30Days: number; collectedPkrLast30Days: number };
  pinnedPlanVersion: { id: string; version: number } | null;
  entitlementOverrides: Record<string, unknown>;
  plan: { name: string; slug: string } | null;
};

type PlanVersion = { id: string; version: number; pricePkr: number; createdAt: string };

type TenantFlag = { id: string; key: string; description: string; enabled: boolean; source: string };

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
  const [profile, setProfile] = useState({
    displayName: "",
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    city: "",
    hostname: "",
    isTest: false,
  });
  const [statusReason, setStatusReason] = useState("");
  const [planId, setPlanId] = useState("");
  const [noteText, setNoteText] = useState("");
  const [supportToken, setSupportToken] = useState("");
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [tagsInput, setTagsInput] = useState("");
  const [planVersions, setPlanVersions] = useState<PlanVersion[]>([]);
  const [pinnedVersionId, setPinnedVersionId] = useState("");
  const [overridesJson, setOverridesJson] = useState("{}");
  const [tenantFlags, setTenantFlags] = useState<TenantFlag[]>([]);
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
          isTest: Boolean(t.tenant.isTest),
        });
        setPlanId(t.tenant.subscription?.planId || "");
        setTagsInput((t.tenant.tags ?? []).join(", "));
      })
      .catch(() => setError("Could not load tenant."));
    void api<Health>(`/tenants/${id}/health`).then(setHealth).catch(() => undefined);
    void api<{ summary: UsageSummary }>(`/tenants/${id}/usage-summary`)
      .then((r) => {
        setUsage(r.summary);
        setPinnedVersionId(r.summary.pinnedPlanVersion?.id || "");
        setOverridesJson(JSON.stringify(r.summary.entitlementOverrides ?? {}, null, 2));
      })
      .catch(() => undefined);
    if (can("flags:read")) {
      void api<{ flags: TenantFlag[] }>(`/tenants/${id}/feature-flags`)
        .then((r) => setTenantFlags(r.flags))
        .catch(() => undefined);
    }
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

  useEffect(() => {
    if (!can("plans:read") || !planId) {
      setPlanVersions([]);
      return;
    }
    void api<{ versions: PlanVersion[] }>(`/plans/${planId}/versions`)
      .then((r) => setPlanVersions(r.versions))
      .catch(() => setPlanVersions([]));
  }, [planId, can]);

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
          isTest: profile.isTest,
          tags: tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
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

  async function setFlagOverride(flag: TenantFlag, enabled: boolean) {
    if (!can("flags:write")) return;
    setMessage("");
    try {
      await api(`/feature-flags/${flag.id}/tenants/${id}`, {
        method: "PUT",
        body: JSON.stringify({ enabled }),
      });
      setMessage(`Flag ${flag.key} set to ${enabled ? "on" : "off"} for this tenant.`);
      reload();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not update flag.");
    }
  }

  async function saveEntitlements() {
    if (!can("tenants:write")) return;
    setMessage("");
    try {
      const entitlementOverrides = JSON.parse(overridesJson) as Record<string, unknown>;
      await api(`/tenants/${id}/subscription`, {
        method: "PATCH",
        body: JSON.stringify({
          pinnedPlanVersionId: pinnedVersionId || null,
          entitlementOverrides,
        }),
      });
      setMessage("Entitlements updated.");
      reload();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not save entitlements.");
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

  if (error) return <p className="flash-error">{error}</p>;
  if (!tenant) return <div className="h-48 animate-pulse rounded-2xl bg-white/5" />;

  const storeUrl = tenantStorefrontUrl(tenant.slug, tenant.hostname);
  const adminUrl = tenantAdminUrl(tenant.slug, tenant.hostname);

  return (
    <div className="space-y-6">
      <BackLink href="/tenants" label="Tenants" />
      <PageHeader
        eyebrow={tenant.slug}
        title={tenant.displayName}
        description={tenant.hostname || `${tenant.slug}.localhost`}
      >
        <StatusBadge status={tenant.status} />
        {can("audit:read") ? (
          <Link href={`/audit?tenantId=${id}`} className="btn-secondary text-sm">Audit</Link>
        ) : null}
        <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
          Store
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
        <a href={adminUrl} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm">
          Admin
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </PageHeader>

      {message ? <p className="flash-ok">{message}</p> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <PanelCard title="Profile" className="lg:col-span-2">
          {can("tenants:write") ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm sm:col-span-2">
                <span className="field-label">Display name</span>
                <input className="input" value={profile.displayName} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} />
              </label>
              <label className="text-sm">
                <span className="field-label">Owner name</span>
                <input className="input" value={profile.ownerName} onChange={(e) => setProfile({ ...profile, ownerName: e.target.value })} />
              </label>
              <label className="text-sm">
                <span className="field-label">Owner email</span>
                <input className="input" type="email" value={profile.ownerEmail} onChange={(e) => setProfile({ ...profile, ownerEmail: e.target.value })} />
              </label>
              <label className="text-sm">
                <span className="field-label">Phone</span>
                <input className="input" value={profile.ownerPhone} onChange={(e) => setProfile({ ...profile, ownerPhone: e.target.value })} />
              </label>
              <label className="text-sm">
                <span className="field-label">City</span>
                <input className="input" value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="field-label">Hostname</span>
                <input className="input font-mono text-xs" placeholder={`${tenant.slug}.localhost`} value={profile.hostname} onChange={(e) => setProfile({ ...profile, hostname: e.target.value })} />
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-400"
                  checked={profile.isTest}
                  onChange={(e) => setProfile({ ...profile, isTest: e.target.checked })}
                />
                <span>Test / demo tenant (excluded from platform KPIs)</span>
              </label>
              <button type="button" className="btn-primary sm:col-span-2" onClick={() => void saveProfile()}>
                Save profile
              </button>
            </div>
          ) : (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="field-label">Owner</dt><dd>{tenant.ownerName || "—"}</dd></div>
              <div><dt className="field-label">Email</dt><dd>{tenant.ownerEmail || "—"}</dd></div>
              <div><dt className="field-label">Hostname</dt><dd className="font-mono text-xs">{tenant.hostname || "—"}</dd></div>
              <div><dt className="field-label">Created</dt><dd>{formatPktDate(tenant.createdAt)}</dd></div>
            </dl>
          )}
          {tenant.deleteScheduledAt ? (
            <p className="mt-3 text-sm text-amber-300">
              Delete scheduled: {formatPktDate(tenant.deleteScheduledAt)}
            </p>
          ) : null}
        </PanelCard>

        <PanelCard title="Usage & tags">
          {usage ? (
            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="field-label">Last active</dt>
                <dd>{usage.lastActiveAt ? formatPktDate(usage.lastActiveAt) : "—"}</dd>
              </div>
              <div>
                <dt className="field-label">Branches</dt>
                <dd>
                  {usage.usage.branches}
                  {usage.limits.maxBranches != null ? ` / ${usage.limits.maxBranches}` : ""}
                </dd>
              </div>
              <div>
                <dt className="field-label">Staff</dt>
                <dd>
                  {usage.usage.staff}
                  {usage.limits.maxStaff != null ? ` / ${usage.limits.maxStaff}` : ""}
                </dd>
              </div>
              <div>
                <dt className="field-label">30d orders</dt>
                <dd>{usage.usage.ordersLast30Days}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-slate-500">Loading usage…</p>
          )}
          {can("tenants:write") ? (
            <label className="mt-3 block text-sm">
              <span className="field-label">Tags (comma-separated)</span>
              <input className="input text-xs" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
            </label>
          ) : null}
        </PanelCard>

        <PanelCard title="Health">
          <p className="text-4xl font-semibold tabular-nums tracking-tight">{health?.score ?? "—"}</p>
          <ul className="mt-4 space-y-2 text-xs text-slate-400">
            {health?.factors.map((f) => (
              <li key={f.id} className="rounded-lg bg-white/[0.03] px-3 py-2">{f.label}</li>
            ))}
          </ul>
        </PanelCard>
      </div>

      <PanelCard title="Subscription">
        {tenant.subscription ? (
          <div className="space-y-3 text-sm">
            <p>
              <strong>{tenant.subscription.plan.name}</strong>
              <span className="text-slate-500"> · {tenant.subscription.status.replace(/_/g, " ")}</span>
            </p>
            {tenant.subscriptionTimeline ? (
              <div
                className={`rounded-xl border px-3 py-3 ${
                  tenant.subscriptionTimeline.urgency === "critical"
                    ? "border-red-500/30 bg-red-500/10"
                    : tenant.subscriptionTimeline.urgency === "warning"
                      ? "border-amber-500/30 bg-amber-500/10"
                      : "border-sky-500/20 bg-sky-500/5"
                }`}
              >
                <p className="font-semibold text-slate-100">{tenant.subscriptionTimeline.headline}</p>
                <dl className="mt-2 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                  {tenant.subscriptionTimeline.trialTotalDays != null ? (
                    <>
                      <div>
                        <dt className="field-label">Trial</dt>
                        <dd>
                          {tenant.subscriptionTimeline.trialDaysRemaining ?? 0} days left of{" "}
                          {tenant.subscriptionTimeline.trialTotalDays}
                        </dd>
                      </div>
                      <div>
                        <dt className="field-label">Trial ends</dt>
                        <dd>
                          {tenant.subscriptionTimeline.trialEndsAt
                            ? formatPktDate(tenant.subscriptionTimeline.trialEndsAt)
                            : "—"}
                        </dd>
                      </div>
                    </>
                  ) : null}
                  <div>
                    <dt className="field-label">Billing</dt>
                    <dd>{tenant.subscriptionTimeline.intervalLabel}</dd>
                  </div>
                  <div>
                    <dt className="field-label">Period ends</dt>
                    <dd>
                      {formatPktDate(tenant.subscriptionTimeline.periodEnd)} ·{" "}
                      {tenant.subscriptionTimeline.periodDaysRemaining}d left
                    </dd>
                  </div>
                </dl>
                {tenant.subscriptionTimeline.adminReadOnly ? (
                  <p className="mt-2 text-xs text-amber-200/90">Tenant admin is read-only until billing is resolved.</p>
                ) : null}
                {tenant.tenantAccess?.statusReason ? (
                  <p className="mt-2 text-xs text-slate-500">{tenant.tenantAccess.statusReason}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No subscription row.</p>
        )}
        {can("tenants:write") && plans.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <label className="text-sm">
              <span className="field-label">Change plan</span>
              <select className="input min-w-[12rem]" value={planId} onChange={(e) => setPlanId(e.target.value)}>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <button type="button" className="btn-secondary" onClick={() => void savePlan()}>Update plan</button>
          </div>
        ) : null}
        {can("tenants:write") && tenant.subscription ? (
          <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Grandfathering & overrides</p>
            <label className="block text-sm">
              <span className="field-label">Pinned plan version</span>
              <select className="input" value={pinnedVersionId} onChange={(e) => setPinnedVersionId(e.target.value)}>
                <option value="">Latest plan entitlements</option>
                {planVersions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version} · PKR {v.pricePkr.toLocaleString()} · {formatPktDate(v.createdAt)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="field-label">Entitlement overrides (JSON)</span>
              <textarea className="input min-h-24 font-mono text-xs" value={overridesJson} onChange={(e) => setOverridesJson(e.target.value)} />
            </label>
            <button type="button" className="btn-secondary" onClick={() => void saveEntitlements()}>Save entitlements</button>
          </div>
        ) : null}
      </PanelCard>

      {can("billing:read") ? <TenantInvoicesSection invoices={invoices} onRefresh={reloadInvoices} /> : null}

      {can("flags:read") && tenantFlags.length > 0 ? (
        <PanelCard title="Feature flags">
          <ul className="divide-y divide-white/5 text-sm">
            {tenantFlags.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <p className="font-mono text-xs text-accent-300">{f.key}</p>
                  <p className="text-xs text-slate-500">{f.description || f.source}</p>
                </div>
                {can("flags:write") ? (
                  <button type="button" className="btn-secondary text-xs" onClick={() => void setFlagOverride(f, !f.enabled)}>
                    {f.enabled ? "ON" : "OFF"} (toggle)
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">{f.enabled ? "ON" : "OFF"}</span>
                )}
              </li>
            ))}
          </ul>
        </PanelCard>
      ) : null}

      {(tenant.domains?.length ?? 0) > 0 || (usage?.domains.length ?? 0) > 0 ? (
        <PanelCard title="Custom domains">
          <ul className="space-y-2 text-sm">
            {(usage?.domains ?? tenant.domains?.map((d) => ({ ...d, status: d.verifiedAt ? "verified" : "pending" })) ?? []).map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 font-mono text-xs">
                <span>{d.hostname}</span>
                <StatusBadge status={d.status === "verified" ? "ACTIVE" : "PENDING"} />
              </li>
            ))}
          </ul>
        </PanelCard>
      ) : null}

      <PanelCard title="Internal notes">
        <ul className="space-y-2 text-sm">
          {(tenant.notes ?? []).length === 0 ? (
            <li className="text-slate-500">No notes yet.</li>
          ) : (
            tenant.notes?.map((n) => (
              <li key={n.id} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-white/[0.04]">
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
      </PanelCard>

      {can("tenants:write") || can("support:write") ? (
        <PanelCard title="Lifecycle & support">
          {can("tenants:write") ? (
            <>
              <label className="block text-sm">
                <span className="field-label">Reason for status change</span>
                <input className="input" value={statusReason} onChange={(e) => setStatusReason(e.target.value)} />
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
            <div className="mt-4 border-t border-slate-200 pt-4 dark:border-white/10">
              <p className="text-sm text-slate-500">One-time token for support login on the tenant host.</p>
              <button type="button" className="btn-primary mt-2" onClick={() => void startSupport()}>
                Issue support token
              </button>
              {supportToken ? (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-100 p-3 dark:bg-white/5">
                  <code className="flex-1 truncate text-xs">{supportToken}</code>
                  <button type="button" className="btn-secondary p-2" onClick={() => copyText(supportToken)} aria-label="Copy token">
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </PanelCard>
      ) : null}
    </div>
  );
}
