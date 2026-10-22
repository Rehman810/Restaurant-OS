"use client";

import { useEffect, useState } from "react";
import { AdminPage, AdminPageHeader } from "@/components/admin/ui/AdminPage";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

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
  } | null;
  entitlements: Record<string, unknown>;
  paymentInstructions: {
    supportEmail?: string;
    legalName?: string;
    ntn?: string;
    bankAccounts: Array<{ label: string; account: string }>;
  };
};

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  status: string;
  amountPkr: number;
  currency: string;
  dueAt: string;
  paidAt: string | null;
};

export default function AdminBillingPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || user.role !== "ADMIN") return;
    void Promise.all([
      api<BillingSummary>("/admin/billing/summary"),
      api<{ invoices: InvoiceRow[] }>("/admin/billing/invoices"),
    ])
      .then(([s, inv]) => {
        setSummary(s);
        setInvoices(inv.invoices ?? []);
      })
      .catch(() => setError("Could not load billing details. Try again in a moment."));
  }, [user]);

  if (user?.role !== "ADMIN") {
    return (
      <AdminPage>
        <AdminPageHeader title="Plan and billing" />
        <p className="text-sm text-muted-foreground">Only the store owner role can view billing.</p>
      </AdminPage>
    );
  }

  return (
    <AdminPage>
      <AdminPageHeader title="Plan and billing" description="Your subscription, invoices, and how to pay." />
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {summary ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h2 className="font-semibold">Current plan</h2>
            {summary.plan ? (
              <>
                <p className="text-lg">{summary.plan.name}</p>
                <p className="text-sm text-muted-foreground">
                  {summary.subscription?.status ?? "—"} · Rs {summary.plan.pricePkr.toLocaleString()} /{" "}
                  {summary.plan.interval === "YEARLY" ? "year" : "month"}
                </p>
                {summary.subscription?.trialEndsAt ? (
                  <p className="text-sm">Trial ends {new Date(summary.subscription.trialEndsAt).toLocaleDateString()}</p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No active subscription on file.</p>
            )}
            {summary.openInvoice ? (
              <div className="mt-4 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-sm">
                <p className="font-medium">Open invoice {summary.openInvoice.invoiceNumber}</p>
                <p>
                  Rs {summary.openInvoice.amountPkr.toLocaleString()} due{" "}
                  {new Date(summary.openInvoice.dueAt).toLocaleDateString()}
                </p>
              </div>
            ) : null}
          </section>
          <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h2 className="font-semibold">Payment instructions</h2>
            {summary.paymentInstructions.supportEmail ? (
              <p className="text-sm">Questions: {summary.paymentInstructions.supportEmail}</p>
            ) : null}
            {summary.paymentInstructions.bankAccounts?.length ? (
              <ul className="text-sm space-y-2">
                {summary.paymentInstructions.bankAccounts.map((row) => (
                  <li key={row.label}>
                    <span className="font-medium">{row.label}</span>
                    <br />
                    {row.account}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Your operator will share bank details on the invoice.</p>
            )}
          </section>
          <section className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
            <h2 className="font-semibold mb-3">Invoices</h2>
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border">
                      <th className="py-2 pr-4">Number</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Amount</th>
                      <th className="py-2">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-border/60">
                        <td className="py-2 pr-4">{inv.invoiceNumber}</td>
                        <td className="py-2 pr-4">{inv.status}</td>
                        <td className="py-2 pr-4">
                          {inv.currency} {inv.amountPkr.toLocaleString()}
                        </td>
                        <td className="py-2">{new Date(inv.dueAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : (
        !error && <div className="skeleton h-48 rounded-2xl" />
      )}
    </AdminPage>
  );
}
