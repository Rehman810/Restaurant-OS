"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Sun } from "lucide-react";
import { api, getApiUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { pkr } from "@/lib/format";
import { AdminPage, AdminPageHeader } from "@/components/admin/ui";

type Summary = {
  date: string;
  orders: number;
  revenue: number;
  aov: number;
  cashTotal: number;
  cardTotal: number;
  discounts: number;
  voids: number;
  refunds: number;
  topItems: { name: string; qty: number }[];
  wasteValue: number;
  lowStockCount: number;
  pendingRiderCash: number;
  unclosedShifts: number;
};

export default function DailySummaryPage() {
  const { user } = useAuth();
  const allowed = user?.role === "ADMIN" || user?.role === "MANAGER";
  const [date, setDate] = useState("");
  const [data, setData] = useState<Summary | null>(null);

  const load = useCallback(async () => {
    const q = date ? `?date=${date}` : "";
    try {
      setData(await api<Summary>(`/admin/reports/daily-summary${q}`));
    } catch {
      setData(null);
    }
  }, [date]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  function printPage() {
    window.print();
  }

  function exportCsv() {
    const q = new URLSearchParams();
    if (date) q.set("date", date);
    q.set("format", "csv");
    window.open(`${getApiUrl()}/admin/reports/daily-summary?${q}`, "_blank");
  }

  if (!allowed) {
    return (
      <AdminPage>
        <AdminPageHeader title="Daily summary" description="Manager access required." />
      </AdminPage>
    );
  }

  return (
    <AdminPage className="print:bg-white">
      <AdminPageHeader
        title="Daily summary"
        description="Owner snapshot for the selected date (store timezone)."
        actions={
          <div className="flex gap-2 print:hidden">
            <button type="button" className="btn-ghost" onClick={exportCsv}><Download size={16} /> CSV</button>
            <button type="button" className="btn-primary" onClick={printPage}>Print</button>
          </div>
        }
      />
      <div className="mb-4 flex gap-2 print:hidden">
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button type="button" className="btn-primary" onClick={() => void load()}>Load</button>
      </div>
      {!data ? (
        <p className="text-sm text-stone-500">No data.</p>
      ) : (
        <div className="space-y-6 rounded-2xl border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-900">
          <div className="flex items-center gap-2">
            <Sun className="text-brand-600" />
            <h2 className="text-lg font-bold">{data.date}</h2>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Orders", data.orders],
              ["Revenue", pkr(data.revenue)],
              ["AOV", pkr(data.aov)],
              ["Cash", pkr(data.cashTotal)],
              ["Card", pkr(data.cardTotal)],
              ["Discounts", pkr(data.discounts)],
              ["Voids", data.voids],
              ["Refunds", pkr(data.refunds)],
              ["Waste value", pkr(data.wasteValue)],
              ["Low stock SKUs", data.lowStockCount],
              ["Pending rider cash", pkr(data.pendingRiderCash)],
              ["Unclosed shifts", data.unclosedShifts],
            ].map(([k, v]) => (
              <div key={String(k)} className="rounded-xl bg-stone-50 p-3 dark:bg-stone-800/50">
                <dt className="text-xs font-semibold uppercase text-stone-500">{k}</dt>
                <dd className="mt-1 text-lg font-bold tabular-nums text-stone-900 dark:text-stone-50">{v}</dd>
              </div>
            ))}
          </dl>
          <div>
            <h3 className="font-semibold">Top items</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {data.topItems.map((t) => (
                <li key={t.name} className="flex justify-between">
                  <span>{t.name}</span>
                  <span className="tabular-nums">{t.qty}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
