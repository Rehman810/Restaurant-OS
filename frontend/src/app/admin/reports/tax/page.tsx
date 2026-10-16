"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Receipt } from "lucide-react";
import { api, getApiUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { pkr } from "@/lib/format";
import { AdminPage, AdminPageHeader } from "@/components/admin/ui";

type TaxCollected = {
  from: string;
  to: string;
  taxTotal: number;
  taxableTotal: number;
  orderCount: number;
};

export default function TaxReportsPage() {
  const { user } = useAuth();
  const allowed = user?.role === "ADMIN" || user?.role === "MANAGER";
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<TaxCollected | null>(null);

  const load = useCallback(async () => {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    try {
      setData(await api<TaxCollected>(`/admin/reports/tax-collected?${q}`));
    } catch {
      setData(null);
    }
  }, [from, to]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  function exportCsv(kind: "tax-collected" | "tax-invoices" | "tax-credit-notes") {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    q.set("format", "csv");
    window.open(`${getApiUrl()}/admin/reports/${kind}?${q}`, "_blank");
  }

  if (!allowed) {
    return (
      <AdminPage>
        <AdminPageHeader title="Tax reports" description="Manager access required." />
      </AdminPage>
    );
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="Tax reports"
        description="Tax collected and invoice registers for the selected range (branch timezone)."
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={() => exportCsv("tax-invoices")}>
              <Download size={16} /> Invoices CSV
            </button>
            <button type="button" className="btn-ghost" onClick={() => exportCsv("tax-credit-notes")}>
              <Download size={16} /> Credit notes CSV
            </button>
            <button type="button" className="btn-primary" onClick={() => exportCsv("tax-collected")}>
              <Download size={16} /> Tax collected CSV
            </button>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <button type="button" className="btn-primary" onClick={() => void load()}>Load</button>
      </div>
      {data ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-stone-500">
              <Receipt size={18} />
              <span className="text-sm font-medium">Orders</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-stone-900">{data.orderCount}</p>
            <p className="text-xs text-stone-500">{data.from} → {data.to}</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-stone-500">Taxable sales</p>
            <p className="mt-2 text-2xl font-bold text-stone-900">{pkr(data.taxableTotal)}</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-stone-500">Tax collected</p>
            <p className="mt-2 text-2xl font-bold text-brand-700">{pkr(data.taxTotal)}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-stone-500">No data for this range.</p>
      )}
    </AdminPage>
  );
}
