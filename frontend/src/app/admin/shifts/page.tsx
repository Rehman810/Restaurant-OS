"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Download, DoorClosed } from "lucide-react";
import { api, getApiUrl } from "@/lib/api";
import { pkr } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/pagination";
import { Pagination } from "@/components/Pagination";
import {
  AdminEmptyState,
  AdminPage,
  AdminPageHeader,
} from "@/components/admin/ui";

type ShiftRow = {
  id: string;
  openedAt: string;
  closedAt: string | null;
  status: string;
  openingCash: string | number;
  expectedCash: string | number | null;
  closingCountedCash: string | number | null;
  variance: string | number | null;
  cashier: { name: string };
  branch: { name: string; code: string };
};

export default function AdminShiftsPage() {
  const [rows, setRows] = useState<ShiftRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * PAGE_SIZE.table;
      const data = await api<{ shifts: ShiftRow[]; total: number }>(
        `/admin/shifts?limit=${PAGE_SIZE.table}&offset=${offset}`
      );
      setRows(data.shifts);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  function exportCsv() {
    window.open(`${getApiUrl()}/admin/shifts/export.csv`, "_blank");
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE.table));

  return (
    <AdminPage>
      <AdminPageHeader
        icon={DoorClosed}
        title="Cash shifts"
        description="Drawer reconciliation by cashier and branch."
        actions={
          <button type="button" className="btn-ghost" onClick={exportCsv}>
            <Download size={16} /> Export CSV
          </button>
        }
      />

      {!loading && rows.length === 0 && (
        <AdminEmptyState
          icon={DoorClosed}
          title="No shifts yet"
          description="Cashiers open a shift from the POS before taking cash."
        />
      )}

      {rows.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-100 bg-stone-50 text-xs uppercase text-stone-500 dark:border-stone-700 dark:bg-stone-800/80">
              <tr>
                <th className="px-4 py-3">Opened</th>
                <th className="px-4 py-3">Cashier</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Expected</th>
                <th className="px-4 py-3">Counted</th>
                <th className="px-4 py-3">Variance</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const v = r.variance != null ? Number(r.variance) : null;
                const hot = v != null && Math.abs(v) > 0.01;
                return (
                  <tr key={r.id} className="border-b border-stone-100 dark:border-stone-800">
                    <td className="px-4 py-3">
                      <Link href={`/admin/shifts/${r.id}`} className="font-medium text-brand-700 hover:underline">
                        {new Date(r.openedAt).toLocaleString()}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{r.cashier.name}</td>
                    <td className="px-4 py-3">{r.branch.code}</td>
                    <td className="px-4 py-3">{r.expectedCash != null ? pkr(r.expectedCash) : "—"}</td>
                    <td className="px-4 py-3">{r.closingCountedCash != null ? pkr(r.closingCountedCash) : "—"}</td>
                    <td className={`px-4 py-3 font-semibold ${hot ? "text-rose-600" : "text-stone-700"}`}>
                      {v != null ? pkr(v) : "—"}
                    </td>
                    <td className="px-4 py-3">{r.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE_SIZE.table && (
        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={total}
          rangeStart={(page - 1) * PAGE_SIZE.table + 1}
          rangeEnd={Math.min(page * PAGE_SIZE.table, total)}
          onPageChange={setPage}
          className="mt-4"
        />
      )}
    </AdminPage>
  );
}
