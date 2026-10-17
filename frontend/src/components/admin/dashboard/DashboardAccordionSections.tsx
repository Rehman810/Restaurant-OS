"use client";

import Link from "next/link";
import { useState } from "react";
import { LayoutGrid, Package, Star, Wallet } from "lucide-react";
import type { DashboardSummary, TopSellerRow } from "@/lib/dashboard/types";
import { pkr } from "@/lib/format";
import { pluralizeCount } from "@/lib/dashboard/helpers";

const panelClass =
  "rounded-2xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900";

export function DashboardAccordionSections({
  data,
  showFinancials,
}: {
  data: DashboardSummary;
  showFinancials: boolean;
}) {
  const [topMode, setTopMode] = useState<"quantity" | "revenue">("quantity");
  const topList = topMode === "quantity" ? data.topSellers.byQuantity : data.topSellers.byRevenue;

  const topSellersBody = (
    <>
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          className={`rounded-full px-3 py-1 text-xs font-bold ${topMode === "quantity" ? "bg-brand-600 text-white" : "bg-stone-100 dark:bg-stone-800"}`}
          onClick={() => setTopMode("quantity")}
        >
          By quantity
        </button>
        <button
          type="button"
          className={`rounded-full px-3 py-1 text-xs font-bold ${topMode === "revenue" ? "bg-brand-600 text-white" : "bg-stone-100 dark:bg-stone-800"}`}
          onClick={() => setTopMode("revenue")}
        >
          By revenue
        </button>
      </div>
      <ul className="space-y-3">
        {topList.map((row) => (
          <TopSellerRowItem key={`${row.name}-${topMode}`} row={row} mode={topMode} />
        ))}
        {topList.length === 0 && <p className="text-sm text-stone-500">No sales yet today.</p>}
      </ul>
    </>
  );

  const lowStockBody =
    data.lowStock.count > 0 ? (
      <>
        <ul className="text-sm">
          {data.lowStock.items.map((i) => (
            <li key={i.name} className="flex justify-between py-1">
              <span>{i.name}</span>
              <span className="text-stone-500">
                {i.quantity} {i.unit} · reorder {i.reorderPoint}
              </span>
            </li>
          ))}
        </ul>
        <Link href="/admin/inventory" className="mt-2 inline-block text-sm font-bold text-brand-700">
          Inventory →
        </Link>
      </>
    ) : (
      <p className="text-sm text-stone-500">No low-stock items.</p>
    );

  const dineInBody = (
    <>
      <p>Pending booking confirmations: {data.dineIn.pendingBookingConfirmations}</p>
      <p>Waitlist: {data.dineIn.waitlistLength}</p>
      <Link href="/admin/dine-in" className="mt-2 inline-block font-bold text-brand-700">Open dine-in →</Link>
    </>
  );

  const feedbackBody =
    data.feedback.count === 0 ? (
      <p className="text-stone-500">No ratings yet today.</p>
    ) : (
      <>
        <p>Average: {data.feedback.avgRating ?? "—"} / 5</p>
        <p>Low ratings (≤{data.thresholds.lowRatingThreshold}): {data.feedback.lowRatingCount}</p>
      </>
    );

  const controlBody =
    showFinancials && data.shifts ? (
      <>
        <ul className="space-y-2">
          {data.shifts.open.map((s) => (
            <li key={s.id}>{s.cashierName} · expected {pkr(s.expectedCash)}</li>
          ))}
          {data.shifts.open.length === 0 && <li>No open shifts</li>}
        </ul>
        {data.riderCash && data.riderCash.pendingCount > 0 && (
          <p className="mt-2">
            Rider COD pending: {pkr(data.riderCash.pendingTotal)} ({data.riderCash.pendingCount})
            <Link href="/admin/riders/cash" className="ml-2 font-bold text-brand-700">Settle →</Link>
          </p>
        )}
        {data.controls && (
          <p className="mt-2 text-xs text-stone-500">
            Voids {data.controls.voids.count} ({pkr(data.controls.voids.total)}) · Refunds{" "}
            {pkr(data.controls.refunds.total)} · Discounts {pkr(data.controls.discounts.total)}
          </p>
        )}
        {data.controls?.topStaff.length ? (
          <ul className="mt-2 text-xs">
            {data.controls.topStaff.map((s) => (
              <li key={s.userId}>
                {s.name}: voids {pkr(s.voidValue)}, discounts {pkr(s.discountValue)}
              </li>
            ))}
          </ul>
        ) : null}
        <Link href="/admin/audit-log" className="mt-2 inline-block font-bold text-brand-700">Audit log →</Link>
      </>
    ) : null;

  return (
    <>
      <div className="space-y-3 md:hidden">
        <details className={panelClass} open>
          <summary className="cursor-pointer px-4 py-3 font-semibold text-stone-900 dark:text-stone-50">
            Top sellers ({topList.length})
          </summary>
          <div className="border-t border-stone-100 px-4 py-3 dark:border-stone-800">{topSellersBody}</div>
        </details>

        {data.lowStock.count > 0 && (
          <details className={panelClass}>
            <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 font-semibold">
              <Package size={18} aria-hidden />
              Low stock ({data.lowStock.count})
            </summary>
            <div className="border-t border-stone-100 px-4 py-3 text-sm dark:border-stone-800">{lowStockBody}</div>
          </details>
        )}

        <details className={panelClass}>
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 font-semibold">
            <LayoutGrid size={18} aria-hidden />
            Dine-in ({data.dineIn.tablesOccupied}/{data.dineIn.tablesTotal} tables)
          </summary>
          <div className="border-t border-stone-100 px-4 py-3 text-sm dark:border-stone-800">{dineInBody}</div>
        </details>

        <details className={panelClass}>
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 font-semibold">
            <Star size={18} aria-hidden />
            Feedback today ({data.feedback.count})
          </summary>
          <div className="border-t border-stone-100 px-4 py-3 text-sm dark:border-stone-800">{feedbackBody}</div>
        </details>

        {controlBody && (
          <details className={panelClass}>
            <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 font-semibold">
              <Wallet size={18} aria-hidden />
              Control & cash ({data.shifts!.open.length} open shifts)
            </summary>
            <div className="border-t border-stone-100 px-4 py-3 text-sm dark:border-stone-800">{controlBody}</div>
          </details>
        )}
      </div>

      <div className="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-3">
        <section className={`${panelClass} p-4 sm:p-5`}>
          <h3 className="font-semibold text-stone-900 dark:text-stone-50">Top sellers ({topList.length})</h3>
          <div className="mt-3">{topSellersBody}</div>
        </section>

        <section className={`${panelClass} p-4 sm:p-5`}>
          <h3 className="flex items-center gap-2 font-semibold text-stone-900 dark:text-stone-50">
            <Package size={18} aria-hidden />
            Low stock ({data.lowStock.count})
          </h3>
          <div className="mt-3 text-sm">{lowStockBody}</div>
        </section>

        <section className={`${panelClass} p-4 sm:p-5`}>
          <h3 className="flex items-center gap-2 font-semibold text-stone-900 dark:text-stone-50">
            <LayoutGrid size={18} aria-hidden />
            Dine-in ({data.dineIn.tablesOccupied}/{data.dineIn.tablesTotal})
          </h3>
          <div className="mt-3 text-sm">{dineInBody}</div>
        </section>

        <section className={`${panelClass} p-4 sm:p-5`}>
          <h3 className="flex items-center gap-2 font-semibold text-stone-900 dark:text-stone-50">
            <Star size={18} aria-hidden />
            Feedback today ({data.feedback.count})
          </h3>
          <div className="mt-3 text-sm">{feedbackBody}</div>
        </section>

        {controlBody && (
          <section className={`${panelClass} p-4 sm:p-5 md:col-span-2 lg:col-span-1`}>
            <h3 className="flex items-center gap-2 font-semibold text-stone-900 dark:text-stone-50">
              <Wallet size={18} aria-hidden />
              Control & cash ({data.shifts!.open.length} open)
            </h3>
            <div className="mt-3 text-sm">{controlBody}</div>
          </section>
        )}
      </div>
    </>
  );
}

function TopSellerRowItem({ row, mode }: { row: TopSellerRow; mode: "quantity" | "revenue" }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="font-semibold text-stone-800 dark:text-stone-200">{row.name}</span>
      <span className="flex items-center gap-2">
        {mode === "quantity" ? pluralizeCount(row.quantity, "sale") : pkr(row.revenue)}
        {row.costKnown && row.marginPercent != null ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            {row.marginPercent}% margin
          </span>
        ) : (
          <span className="text-[10px] font-semibold text-stone-400">Cost unknown</span>
        )}
      </span>
    </li>
  );
}
