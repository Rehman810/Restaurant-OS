"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError, getApiUrl } from "@/lib/api";
import { usePlatformAuth } from "@/lib/auth";
import { ForbiddenPage } from "@/components/RequirePermission";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { BackLink } from "@/components/BackLink";
import { formatPktDate, formatPkr } from "@/lib/format";

type Proof = {
  id: string;
  status: string;
  method: string;
  reference: string;
  amountPkr: number;
  paidAt: string;
  receiptPath: string;
  restaurant: { id: string; displayName: string; slug: string };
  invoice: { invoiceNumber: string };
};

export default function VerificationQueuePage() {
  const { can } = usePlatformAuth();
  const [status, setStatus] = useState("PENDING");
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [message, setMessage] = useState("");

  function reload() {
    void api<{ proofs: Proof[] }>(`/payment-proofs?status=${encodeURIComponent(status)}`).then((r) => setProofs(r.proofs));
  }

  useEffect(() => {
    if (can("billing:read")) reload();
  }, [status, can]);

  if (!can("billing:read")) return <ForbiddenPage />;

  async function approve(id: string) {
    if (!can("billing:write")) return;
    try {
      await api(`/payment-proofs/${id}/approve`, { method: "POST" });
      setMessage("Payment approved and invoice marked paid.");
      reload();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Approve failed.");
    }
  }

  async function reject(id: string) {
    if (!can("billing:write")) return;
    const reason = window.prompt("Rejection reason (sent to tenant)");
    if (!reason?.trim()) return;
    try {
      await api(`/payment-proofs/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) });
      setMessage("Payment proof rejected.");
      reload();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Reject failed.");
    }
  }

  return (
    <div className="space-y-6">
      <BackLink href="/billing" label="Billing" />
      <PageHeader title="Payment verification" description="Tenant-submitted proofs awaiting review" />
      <select className="input max-w-[12rem]" value={status} onChange={(e) => setStatus(e.target.value)}>
        {["PENDING", "APPROVED", "REJECTED"].map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <DataTable>
        <thead>
          <tr>
            <th>Tenant</th>
            <th>Invoice</th>
            <th>Method</th>
            <th>Reference</th>
            <th>Amount</th>
            <th>Paid</th>
            <th>Receipt</th>
            {can("billing:write") && status === "PENDING" ? <th /> : null}
          </tr>
        </thead>
        <tbody>
          {proofs.map((p) => (
            <tr key={p.id}>
              <td>
                <Link href={`/tenants/${p.restaurant.id}`} className="text-accent-400 hover:underline">
                  {p.restaurant.displayName || p.restaurant.slug}
                </Link>
              </td>
              <td>{p.invoice.invoiceNumber}</td>
              <td>{p.method.replace(/_/g, " ")}</td>
              <td className="font-mono text-xs">{p.reference || "—"}</td>
              <td>{formatPkr(p.amountPkr)}</td>
              <td>{formatPktDate(p.paidAt)}</td>
              <td>
                {p.receiptPath ? (
                  <a href={`${getApiUrl()}${p.receiptPath}`} target="_blank" rel="noopener noreferrer" className="text-xs text-accent-400 hover:underline">
                    View
                  </a>
                ) : (
                  "—"
                )}
              </td>
              {can("billing:write") && status === "PENDING" ? (
                <td className="space-x-2 text-xs">
                  <button type="button" className="text-emerald-400 hover:underline" onClick={() => void approve(p.id)}>Approve</button>
                  <button type="button" className="text-rose-400 hover:underline" onClick={() => void reject(p.id)}>Reject</button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </DataTable>
      {message ? <p className="text-sm text-accent-400">{message}</p> : null}
    </div>
  );
}
