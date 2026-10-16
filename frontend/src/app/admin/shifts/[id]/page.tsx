"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, DoorClosed } from "lucide-react";
import { api } from "@/lib/api";
import { pkr } from "@/lib/format";
import { AdminPage, AdminPageHeader } from "@/components/admin/ui";

type Movement = {
  id: string;
  type: string;
  amount: string | number;
  reason: string;
  createdAt: string;
  order?: { orderNumber: string } | null;
};

export default function ShiftDetailPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const [shift, setShift] = useState<{
    openedAt: string;
    closedAt: string | null;
    openingCash: string | number;
    expectedCash: string | number | null;
    closingCountedCash: string | number | null;
    variance: string | number | null;
    note: string | null;
    closingManagerNote: string | null;
    cashier: { name: string };
    branch: { name: string };
    movements: Movement[];
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    void api<{ shift: typeof shift }>(`/admin/shifts/${id}`).then((d) => setShift(d.shift));
  }, [id]);

  return (
    <AdminPage>
      <Link href="/admin/shifts" className="mb-4 inline-flex items-center gap-1 text-sm text-brand-700">
        <ArrowLeft size={16} /> Back to shifts
      </Link>
      {shift && (
        <>
          <AdminPageHeader
            icon={DoorClosed}
            title={`Shift · ${shift.cashier.name}`}
            description={`${shift.branch.name} · ${new Date(shift.openedAt).toLocaleString()}`}
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900">
              <p className="text-xs text-stone-500">Opening</p>
              <p className="text-lg font-bold">{pkr(shift.openingCash)}</p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900">
              <p className="text-xs text-stone-500">Expected</p>
              <p className="text-lg font-bold">{shift.expectedCash != null ? pkr(shift.expectedCash) : "—"}</p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900">
              <p className="text-xs text-stone-500">Counted</p>
              <p className="text-lg font-bold">
                {shift.closingCountedCash != null ? pkr(shift.closingCountedCash) : "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900">
              <p className="text-xs text-stone-500">Variance</p>
              <p className="text-lg font-bold text-rose-600">
                {shift.variance != null ? pkr(shift.variance) : "—"}
              </p>
            </div>
          </div>
          {(shift.note || shift.closingManagerNote) && (
            <p className="mt-3 text-sm text-stone-600">{shift.closingManagerNote || shift.note}</p>
          )}
          <h2 className="mt-6 text-sm font-semibold uppercase text-stone-500">Movements</h2>
          <ul className="mt-2 divide-y rounded-2xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900">
            {shift.movements.map((m) => (
              <li key={m.id} className="flex justify-between gap-4 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{m.type.replace(/_/g, " ")}</p>
                  <p className="text-stone-500">{m.reason}</p>
                  {m.order && <p className="text-xs text-stone-400">{m.order.orderNumber}</p>}
                </div>
                <span className="font-semibold">{pkr(m.amount)}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn-ghost mt-6"
            onClick={() => window.print()}
          >
            Print Z-report
          </button>
        </>
      )}
    </AdminPage>
  );
}
