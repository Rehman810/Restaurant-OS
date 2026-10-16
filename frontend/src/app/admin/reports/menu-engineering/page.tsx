"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, PieChart } from "lucide-react";
import { api, getApiUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { pkr } from "@/lib/format";
import { AdminEmptyState, AdminFilterBar, AdminPage, AdminPageHeader } from "@/components/admin/ui";

type Row = {
  menuItemId: string;
  name: string;
  category: string;
  classification: string;
  quantitySold: number;
  revenue: number;
  marginPercent: number | null;
  foodCostPercent: number | null;
  costStatus: string;
};

const CLASS_HELP: Record<string, string> = {
  STAR: "High volume & high margin — promote and protect quality.",
  PLOWHORSE: "High volume, lower margin — watch portion cost and price.",
  PUZZLE: "Strong margin but slow sellers — market or rename.",
  DOG: "Low volume & margin — consider removing or reworking.",
};

export default function MenuEngineeringPage() {
  const { user } = useAuth();
  const allowed = user?.role === "ADMIN" || user?.role === "MANAGER";
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [category, setCategory] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (from) q.set("from", from);
      if (to) q.set("to", to);
      if (category) q.set("category", category);
      const data = await api<{ rows: Row[] }>(`/admin/reports/menu-engineering?${q}`);
      setRows(data.rows);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [from, to, category]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  function exportCsv() {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    if (category) q.set("category", category);
    q.set("format", "csv");
    window.open(`${getApiUrl()}/admin/reports/menu-engineering?${q}`, "_blank");
  }

  if (!allowed) {
    return (
      <AdminPage>
        <AdminPageHeader title="Menu engineering" description="Manager access required." />
      </AdminPage>
    );
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="Menu engineering"
        description="Stars, plowhorses, puzzles, and dogs by sales volume vs margin (branch weighted-average recipe cost)."
        actions={
          <button type="button" className="btn-ghost gap-2" onClick={exportCsv}>
            <Download size={16} /> CSV
          </button>
        }
      />
      <AdminFilterBar>
        <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <input className="input" placeholder="Category filter" value={category} onChange={(e) => setCategory(e.target.value)} />
        <button type="button" className="btn-primary" onClick={() => void load()}>Apply</button>
      </AdminFilterBar>
      {loading ? (
        <p className="text-sm text-stone-500">Loading…</p>
      ) : rows.length === 0 ? (
        <AdminEmptyState icon={PieChart} title="No sales in range" description="Adjust dates or branch selection." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 dark:border-stone-700">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500 dark:bg-stone-800">
              <tr>
                <th className="p-3">Item</th>
                <th className="p-3">Class</th>
                <th className="p-3">Qty</th>
                <th className="p-3">Revenue</th>
                <th className="p-3">Margin %</th>
                <th className="p-3">Food cost %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.menuItemId} className="border-t border-stone-100 dark:border-stone-800">
                  <td className="p-3">
                    <p className="font-semibold text-stone-900 dark:text-stone-50">{r.name}</p>
                    <p className="text-xs text-stone-500">{r.category}</p>
                  </td>
                  <td className="p-3" title={CLASS_HELP[r.classification]}>
                    <span className="rounded-lg bg-brand-50 px-2 py-1 text-xs font-bold text-brand-800">{r.classification}</span>
                  </td>
                  <td className="p-3 tabular-nums">{r.quantitySold}</td>
                  <td className="p-3 tabular-nums">{pkr(r.revenue)}</td>
                  <td className="p-3 tabular-nums">{r.marginPercent != null ? `${r.marginPercent}%` : "—"}</td>
                  <td className="p-3 tabular-nums">
                    {r.costStatus !== "ok" ? "Cost unknown" : r.foodCostPercent != null ? `${r.foodCostPercent}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPage>
  );
}
