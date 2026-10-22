"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Check, Copy, CreditCard, Mail, Minus, Receipt, Users } from "lucide-react";
import {
  AdminAlert,
  AdminEmptyState,
  AdminKpiCard,
  AdminKpiGrid,
  AdminPage,
  AdminPageHeader,
  AdminPanel,
} from "@/components/admin/ui";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { normalizeEntitlements, resolveModuleAccess, type TenantEntitlements } from "@/lib/plan-entitlements";
import type { ModuleAccess } from "@/lib/module-access";
import { PLAN_MODULES } from "@/lib/plan-modules";
import {
  formatSubscriptionDate,
  subscriptionBannerTone,
  type SubscriptionTimeline,
  type TenantAccessSnapshot,
} from "@/lib/subscription-timeline";

type BillingSummary = {
  plan: { name: string; slug: string; pricePkr: number; interval: string; currency: string } | null;
  subscription: {
    status: string;
    trialEndsAt: string | null;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  } | null;
  openInvoice: {
    id: string;
    invoiceNumber: string;
    amountPkr: number;
    currency: string;
    dueAt: string;
    periodStart?: string;
    periodEnd?: string;
  } | null;
  entitlements: Record<string, unknown>;
  paymentInstructions: {
    supportEmail?: string;
    legalName?: string;
    ntn?: string;
    bankAccounts: Array<{ label: string; account: string }>;
  };
  subscriptionTimeline: SubscriptionTimeline | null;
  tenant: TenantAccessSnapshot | null;
};

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  status: string;
  amountPkr: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  dueAt: string;
  paidAt: string | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
}

function statusTone(status: string) {
  const s = status.toUpperCase();
  if (s === "ACTIVE" || s === "PAID") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300";
  if (s === "TRIAL") return "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300";
  if (s === "OPEN" || s === "PAST_DUE") return "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200";
  return "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300";
}

function accessSummary(access: ModuleAccess) {
  if (!access.read) return "Not included";
  if (access.edit && access.delete) return "Full access";
  if (access.edit) return "View & edit";
  return "View only";
}

function limitLabel(value: number | null | undefined) {
  if (value === null || value === undefined) return "Unlimited";
  return String(value);
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      <Copy className="h-3.5 w-3.5" aria-hidden />
      {copied ? "Copied" : label}
    </button>
  );
}

function LicenseModulesList({ entitlements }: { entitlements: TenantEntitlements }) {
  const rows = useMemo(
    () =>
      PLAN_MODULES.map((mod) => ({
        mod,
        included: resolveModuleAccess(entitlements, mod.id).read,
        access: accessSummary(resolveModuleAccess(entitlements, mod.id)),
      })),
    [entitlements]
  );

  return (
    <ul className="divide-y divide-stone-100 dark:divide-stone-800">
      {rows.map(({ mod, included, access }) => (
        <li key={mod.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className={`text-sm font-medium ${included ? "text-stone-900 dark:text-stone-100" : "text-stone-500"}`}>
              {mod.label}
            </p>
            <p className="text-xs text-stone-500">{included ? access : "Upgrade plan to unlock"}</p>
          </div>
          <span
            className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ring-1 ${
              included
                ? "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-900/50"
                : "bg-stone-50 text-stone-400 ring-stone-200 dark:bg-stone-800/50 dark:ring-stone-700"
            }`}
            aria-hidden
          >
            {included ? <Check className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function AdminBillingPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(() => {
    if (!user || user.role !== "ADMIN") return;
    setLoading(true);
    setError("");
    void Promise.all([
      api<BillingSummary>("/admin/billing/summary"),
      api<{ invoices: InvoiceRow[] }>("/admin/billing/invoices"),
    ])
      .then(([s, inv]) => {
        setSummary(s);
        setInvoices(inv.invoices ?? []);
        setUpdatedAt(new Date());
      })
      .catch(() => setError("Could not load billing details. Try again in a moment."))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const ent = useMemo(() => (summary ? normalizeEntitlements(summary.entitlements) : null), [summary]);

  if (user?.role !== "ADMIN") {
    return (
      <AdminPage>
        <AdminPageHeader title="Plan and billing" icon={Receipt} />
        <AdminAlert variant="warning">Only the store owner (Admin) role can view billing and invoices.</AdminAlert>
      </AdminPage>
    );
  }

  const status = summary?.subscription?.status?.replace(/_/g, " ");

  return (
    <AdminPage>
      <AdminPageHeader
        title="Plan and billing"
        description="Subscription, license modules, invoices, and payment details from Restaurant OS."
        icon={Receipt}
        iconAccent="brand"
        trailing={
          status ? (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${statusTone(summary!.subscription!.status)}`}>
              {status}
            </span>
          ) : null
        }
        actions={<RefreshButton busy={loading} onClick={load} updatedAt={updatedAt} />}
      />

      {error ? <AdminAlert variant="error">{error}</AdminAlert> : null}

      {loading && !summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="skeleton h-24 rounded-2xl" />
          <div className="skeleton h-24 rounded-2xl" />
          <div className="skeleton h-24 rounded-2xl" />
          <div className="skeleton h-24 rounded-2xl" />
        </div>
      ) : null}

      {summary && ent ? (
        <>
          {summary.subscriptionTimeline ? (
            <div
              className={`rounded-2xl border px-4 py-4 sm:px-5 ${subscriptionBannerTone(summary.subscriptionTimeline.urgency)}`}
            >
              <p className="text-base font-semibold">{summary.subscriptionTimeline.headline}</p>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                {summary.subscriptionTimeline.phase === "trialing" ? (
                  <>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide opacity-70">Trial length</dt>
                      <dd className="mt-0.5 font-medium tabular-nums">
                        {summary.subscriptionTimeline.trialTotalDays ?? "—"} days
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide opacity-70">Days left</dt>
                      <dd className="mt-0.5 font-medium tabular-nums">
                        {summary.subscriptionTimeline.trialDaysRemaining ?? 0}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide opacity-70">Trial ends</dt>
                      <dd className="mt-0.5 font-medium">
                        {summary.subscriptionTimeline.trialEndsAt
                          ? formatSubscriptionDate(summary.subscriptionTimeline.trialEndsAt)
                          : "—"}
                      </dd>
                    </div>
                  </>
                ) : null}
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide opacity-70">Billing cycle</dt>
                  <dd className="mt-0.5 font-medium">{summary.subscriptionTimeline.intervalLabel}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide opacity-70">
                    {summary.subscriptionTimeline.phase === "trialing" ? "First period ends" : "Current period ends"}
                  </dt>
                  <dd className="mt-0.5 font-medium">
                    {formatSubscriptionDate(summary.subscriptionTimeline.periodEnd)}
                    {summary.subscriptionTimeline.phase !== "trialing" ? (
                      <span className="ml-1 text-xs opacity-80">
                        ({summary.subscriptionTimeline.periodDaysRemaining} days left)
                      </span>
                    ) : null}
                  </dd>
                </div>
              </dl>
              {summary.subscriptionTimeline.adminReadOnly ? (
                <p className="mt-3 text-xs font-medium opacity-90">
                  Full access is paused until payment is recorded. You can still view this page and payment details.
                </p>
              ) : summary.subscriptionTimeline.phase === "trialing" ? (
                <p className="mt-3 text-xs opacity-90">
                  When the trial ends, an invoice is issued and the admin panel becomes read-only until Restaurant OS
                  records your payment.
                </p>
              ) : null}
              {summary.tenant?.statusReason ? (
                <p className="mt-2 text-xs opacity-80">{summary.tenant.statusReason}</p>
              ) : null}
            </div>
          ) : null}

          <AdminKpiGrid className="grid-cols-2 lg:grid-cols-4">
            <AdminKpiCard
              compact
              label="Current plan"
              value={summary.plan?.name ?? "—"}
              hint={summary.plan?.slug}
              icon={Receipt}
              accent="brand"
            />
            <AdminKpiCard
              compact
              label={summary.plan?.interval === "YEARLY" ? "Price / year" : "Price / month"}
              value={summary.plan ? formatMoney(summary.plan.pricePkr) : "—"}
              hint={
                summary.subscription
                  ? `${formatDate(summary.subscription.currentPeriodStart)} – ${formatDate(summary.subscription.currentPeriodEnd)}`
                  : undefined
              }
              icon={CreditCard}
              accent="orange"
            />
            <AdminKpiCard
              compact
              label="Branch limit"
              value={limitLabel(ent.maxBranches)}
              icon={Building2}
              accent="sky"
            />
            <AdminKpiCard
              compact
              label="Staff limit"
              value={limitLabel(ent.maxStaff)}
              icon={Users}
              accent="emerald"
            />
          </AdminKpiGrid>

          {summary.subscription?.cancelAtPeriodEnd ? (
            <AdminAlert variant="info">Subscription is set to cancel at the end of the current period.</AdminAlert>
          ) : null}

          {summary.openInvoice ? (
            <AdminAlert variant="warning">
              Invoice <strong>{summary.openInvoice.invoiceNumber}</strong> — {formatMoney(summary.openInvoice.amountPkr)} due{" "}
              {formatDate(summary.openInvoice.dueAt)}. Pay using the details below and email proof to support.
            </AdminAlert>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-2">
            <AdminPanel title="License modules" description="What your plan unlocks in this admin panel">
              <LicenseModulesList entitlements={ent} />
              <p className="mt-3 text-xs text-stone-500">Settings and this page are always available.</p>
            </AdminPanel>

            <AdminPanel title="How to pay" description="Manual billing — bank transfer, JazzCash, Easypaisa">
              <div className="space-y-4 text-sm">
                {summary.paymentInstructions.legalName ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Payable to</p>
                    <p className="mt-0.5 font-medium text-stone-900 dark:text-stone-100">
                      {summary.paymentInstructions.legalName}
                    </p>
                    {summary.paymentInstructions.ntn ? (
                      <p className="text-xs text-stone-500">NTN {summary.paymentInstructions.ntn}</p>
                    ) : null}
                  </div>
                ) : null}
                {summary.paymentInstructions.supportEmail ? (
                  <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-3 dark:border-stone-700 dark:bg-stone-800/40">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
                      <Mail className="h-3.5 w-3.5" aria-hidden />
                      Support
                    </p>
                    <a
                      href={`mailto:${summary.paymentInstructions.supportEmail}`}
                      className="mt-1 block font-medium text-brand-700 hover:underline dark:text-brand-300"
                    >
                      {summary.paymentInstructions.supportEmail}
                    </a>
                    <CopyButton text={summary.paymentInstructions.supportEmail} label="Copy email" />
                  </div>
                ) : (
                  <p className="text-stone-500">Your operator will share a support contact on invoices.</p>
                )}
                {summary.paymentInstructions.bankAccounts?.length ? (
                  <ul className="space-y-2">
                    {summary.paymentInstructions.bankAccounts.map((row) => (
                      <li
                        key={row.label}
                        className="rounded-xl border border-stone-200 bg-stone-50/80 p-3 dark:border-stone-700 dark:bg-stone-800/40"
                      >
                        <p className="font-semibold text-stone-900 dark:text-stone-100">{row.label}</p>
                        <p className="mt-1 font-mono text-xs leading-relaxed text-stone-600 dark:text-stone-300">
                          {row.account}
                        </p>
                        <CopyButton text={row.account} label="Copy details" />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-xl border border-dashed border-stone-200 px-3 py-4 text-center text-xs text-stone-500 dark:border-stone-700">
                    Bank details appear when your operator adds them in platform settings.
                  </p>
                )}
              </div>
            </AdminPanel>
          </div>

          <AdminPanel title="Invoice history">
            {invoices.length === 0 ? (
              <AdminEmptyState
                compact
                icon={Receipt}
                title="No invoices yet"
                description="Platform invoices are created each billing period."
              />
            ) : (
              <div className="-mx-1 overflow-x-auto">
                <table className="w-full min-w-[32rem] text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-left text-xs font-semibold uppercase tracking-wide text-stone-500 dark:border-stone-700">
                      <th className="pb-2 pr-4">Invoice</th>
                      <th className="pb-2 pr-4">Period</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2 pr-4">Amount</th>
                      <th className="pb-2">Due / paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-stone-100 dark:border-stone-800">
                        <td className="py-2.5 pr-4 font-mono text-xs">{inv.invoiceNumber}</td>
                        <td className="py-2.5 pr-4 text-xs text-stone-600 dark:text-stone-400">
                          {formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}
                        </td>
                        <td className="py-2.5 pr-4">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusTone(inv.status)}`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 font-medium tabular-nums">{formatMoney(inv.amountPkr)}</td>
                        <td className="py-2.5 text-xs text-stone-600 dark:text-stone-400">
                          {inv.paidAt ? `Paid ${formatDate(inv.paidAt)}` : `Due ${formatDate(inv.dueAt)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AdminPanel>
        </>
      ) : null}
    </AdminPage>
  );
}
