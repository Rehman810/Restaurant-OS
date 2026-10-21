"use client";

import { useMemo, useState } from "react";
import type { AdminBranch } from "@/modules/branches/types";
import { formatMoney } from "@/lib/branches/helpers";
import { AdminSurface } from "@/components/admin/ui";

type SortKey = "name" | "orders" | "collected" | "avgOrderValue" | "latePercent" | "rating";

export function BranchesPerformance({ branches }: { branches: AdminBranch[] }) {
  const [open, setOpen] = useState(true);
  const [sort, setSort] = useState<SortKey>("collected");
  const rows = useMemo(() => {
    const withPerf = branches.filter((b) => b.performance);
    return [...withPerf].sort((a, b) => {
      const pa = a.performance!;
      const pb = b.performance!;
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "orders") return pb.orders - pa.orders;
      if (sort === "collected") return pb.collected - pa.collected;
      if (sort === "avgOrderValue") return pb.avgOrderValue - pa.avgOrderValue;
      if (sort === "latePercent") return pb.latePercent - pa.latePercent;
      return (pb.avgRating ?? 0) - (pa.avgRating ?? 0);
    });
  }, [branches, sort]);

  function exportCsv() {
    const header = "Branch,Orders,Collected,Avg order,Late %,Rating\n";
    const body = rows
      .map((b) => {
        const p = b.performance!;
        const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
        return [esc(b.name), p.orders, p.collected, p.avgOrderValue, p.latePercent, p.avgRating ?? ""].join(",");
      })
      .join("\n");
    const blob = new Blob(["\uFEFF" + header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "branch-performance.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!rows.length) return null;

  return (
    <AdminSurface className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="text-left text-sm font-semibold" onClick={() => setOpen((v) => !v)}>
          Branch performance {open ? "▾" : "▸"}
        </button>
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 text-xs">
            Sort
            <select className="input py-1 text-xs" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="collected">Collected</option>
              <option value="orders">Orders</option>
              <option value="avgOrderValue">Avg order</option>
              <option value="latePercent">Late %</option>
              <option value="rating">Rating</option>
              <option value="name">Name</option>
            </select>
          </label>
          <button type="button" className="rounded-xl border px-3 py-1.5 text-xs font-semibold" onClick={exportCsv}>
            Export CSV
          </button>
        </div>
      </div>
      {open && (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-stone-500">
                  <th className="py-2 pr-4">Branch</th>
                  <th className="py-2 pr-4">Orders</th>
                  <th className="py-2 pr-4">Collected</th>
                  <th className="py-2 pr-4">Avg order</th>
                  <th className="py-2 pr-4">Late %</th>
                  <th className="py-2">Rating</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const p = b.performance!;
                  const d = b.performanceDelta;
                  return (
                    <tr key={b.id} className="border-b border-stone-100 dark:border-stone-800">
                      <td className="py-2 pr-4 font-medium">{b.name}</td>
                      <td className="py-2 pr-4 tabular-nums">{p.orders}{d ? <Delta n={d.orders} /> : null}</td>
                      <td className="py-2 pr-4 tabular-nums">{formatMoney(p.collected)}{d ? <Delta n={d.collected} money /> : null}</td>
                      <td className="py-2 pr-4 tabular-nums">{formatMoney(p.avgOrderValue)}</td>
                      <td className="py-2 pr-4 tabular-nums">{p.latePercent}%</td>
                      <td className="py-2 tabular-nums">{p.avgRating ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ul className="space-y-2 md:hidden">
            {rows.map((b) => {
              const p = b.performance!;
              return (
                <li key={b.id} className="rounded-xl border border-stone-200 p-3 dark:border-stone-700">
                  <p className="font-semibold">{b.name}</p>
                  <p className="text-xs text-stone-500">{p.orders} orders · {formatMoney(p.collected)} · Late {p.latePercent}%</p>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </AdminSurface>
  );
}

function Delta({ n, money }: { n: number; money?: boolean }) {
  if (!n) return null;
  const sign = n > 0 ? "+" : "";
  const text = money ? formatMoney(n) : String(n);
  return <span className="ml-1 text-xs text-stone-500">({sign}{text})</span>;
}
