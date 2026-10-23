"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Search } from "lucide-react";
import { api } from "@/lib/api";
import { usePlatformAuth } from "@/lib/auth";
import { ForbiddenPage } from "@/components/RequirePermission";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, TableEmpty } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { formatPktDate, formatPkr } from "@/lib/format";

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  status: string;
  amountPkr: number;
  dueAt: string;
  createdAt: string;
  restaurant: { id: string; slug: string; displayName: string; isTest?: boolean };
};

export default function BillingPage() {
  const { can } = usePlatformAuth();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!can("billing:read")) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (debouncedQ.trim()) params.set("q", debouncedQ.trim());
    void api<{ invoices: InvoiceRow[] }>(`/invoices?${params}`)
      .then((r) => setInvoices(r.invoices))
      .finally(() => setLoading(false));
  }, [status, debouncedQ, can]);

  if (!can("billing:read")) return <ForbiddenPage />;

  const exportUrl = `/api/proxy/invoices/export.csv${status ? `?status=${encodeURIComponent(status)}` : ""}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Revenue"
        title="Billing"
        description="Invoices and payment verification across all tenants"
      >
        <Link href="/billing/verification" className="btn-secondary">Verification queue</Link>
        <a href={exportUrl} className="btn-secondary">
          <Download className="h-4 w-4" aria-hidden />
          Export CSV
        </a>
      </PageHeader>

      <div className="surface-card flex flex-wrap gap-3 p-4">
        <label className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input className="input pl-9" placeholder="Invoice #, tenant" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select className="input max-w-[10rem]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {["OPEN", "PAID", "VOID", "DRAFT"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <DataTable footer={loading ? <TableEmpty>Loading…</TableEmpty> : null}>
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Tenant</th>
            <th>Status</th>
            <th>Amount</th>
            <th>Due</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id}>
              <td>
                <Link href={`/billing/invoices/${inv.id}`} className="font-semibold text-accent-400 hover:underline">
                  {inv.invoiceNumber}
                </Link>
              </td>
              <td>
                <Link href={`/tenants/${inv.restaurant.id}`} className="hover:underline">
                  {inv.restaurant.displayName || inv.restaurant.slug}
                </Link>
                {inv.restaurant.isTest ? <span className="ml-1 text-[10px] text-violet-300">TEST</span> : null}
              </td>
              <td><StatusBadge status={inv.status} /></td>
              <td>{formatPkr(inv.amountPkr)}</td>
              <td className="text-slate-500">{formatPktDate(inv.dueAt)}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}
