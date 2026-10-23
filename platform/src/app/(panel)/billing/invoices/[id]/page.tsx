"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { usePlatformAuth } from "@/lib/auth";
import { ForbiddenPage } from "@/components/RequirePermission";
import { PageHeader } from "@/components/PageHeader";
import { PanelCard } from "@/components/PanelCard";
import { BackLink } from "@/components/BackLink";
import { StatusBadge } from "@/components/StatusBadge";
import { RecordInvoicePayment, type InvoiceRow } from "@/components/RecordInvoicePayment";
import { formatPktDate, formatPkr } from "@/lib/format";

type InvoiceDetail = InvoiceRow & {
  periodStart: string;
  periodEnd: string;
  notes: string;
  payments: Array<{ method: string; amountPkr: number; reference: string; receivedAt: string; recordedBy: string }>;
  restaurant: { id: string; slug: string; displayName: string };
  subscription?: { plan: { name: string } };
};

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const invoiceId = String(id);
  const { can } = usePlatformAuth();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [message, setMessage] = useState("");

  function reload() {
    void api<{ invoice: InvoiceDetail }>(`/invoices/${invoiceId}`).then((r) => setInvoice(r.invoice));
  }

  useEffect(() => {
    if (can("billing:read")) reload();
  }, [invoiceId, can]);

  if (!can("billing:read")) return <ForbiddenPage />;
  if (!invoice) return <p className="text-slate-500">Loading invoice…</p>;

  async function voidInvoice() {
    if (!can("billing:write") || !window.confirm("Void this open invoice?")) return;
    try {
      await api(`/invoices/${invoiceId}/void`, { method: "POST" });
      setMessage("Invoice voided.");
      reload();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not void.");
    }
  }

  return (
    <div className="space-y-6">
      <BackLink href="/billing" label="Billing" />
      <PageHeader title={invoice.invoiceNumber} description={`${invoice.restaurant.displayName} · ${invoice.subscription?.plan.name ?? "Plan"}`}>
        {invoice.status === "OPEN" && can("billing:write") ? (
          <button type="button" className="btn-secondary text-rose-300" onClick={() => void voidInvoice()}>Void invoice</button>
        ) : null}
      </PageHeader>

      <PanelCard>
        <div className="flex flex-wrap gap-4 text-sm">
          <div><span className="text-slate-500">Status</span> <StatusBadge status={invoice.status} /></div>
          <div><span className="text-slate-500">Amount</span> {formatPkr(invoice.amountPkr)}</div>
          <div><span className="text-slate-500">Due</span> {formatPktDate(invoice.dueAt)}</div>
          <div>
            <span className="text-slate-500">Tenant</span>{" "}
            <Link href={`/tenants/${invoice.restaurant.id}`} className="text-accent-400 hover:underline">
              {invoice.restaurant.slug}
            </Link>
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Period {formatPktDate(invoice.periodStart)} – {formatPktDate(invoice.periodEnd)}
        </p>
        {can("billing:write") ? (
          <div className="mt-4">
            <RecordInvoicePayment invoice={invoice} onRecorded={reload} />
          </div>
        ) : null}
      </PanelCard>

      {invoice.payments.length ? (
        <PanelCard title="Payments recorded">
          <ul className="space-y-2 text-sm">
            {invoice.payments.map((p, i) => (
              <li key={i} className="rounded-lg border border-white/5 px-3 py-2">
                {formatPkr(p.amountPkr)} via {p.method.replace(/_/g, " ")} · ref {p.reference || "—"} ·{" "}
                {formatPktDate(p.receivedAt)} by {p.recordedBy || "—"}
              </li>
            ))}
          </ul>
        </PanelCard>
      ) : null}

      {message ? <p className="text-sm text-accent-400">{message}</p> : null}
    </div>
  );
}
