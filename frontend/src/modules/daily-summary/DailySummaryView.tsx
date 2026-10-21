"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Mail,
  MoreVertical,
  Printer,
  RefreshCw,
  Sun,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { pkr } from "@/lib/format";
import { formatDelta } from "@/lib/dashboard/helpers";
import {
  AdminAlert,
  AdminEmptyState,
  AdminKpiCard,
  AdminKpiGrid,
  AdminPage,
  AdminPageHeader,
  AdminSurface,
} from "@/components/admin/ui";
import type { DailySummaryPayload } from "./types";
import {
  CompareMode,
  dayStatusLabel,
  formatStoreDateHeading,
  paymentSplitProof,
  pickDelta,
  pluralize,
} from "./helpers";

function DeltaHint({ kpi, mode }: { kpi: DailySummaryPayload["money"]["booked"]; mode: CompareMode }) {
  const { pct, label } = pickDelta(kpi, mode);
  const text = formatDelta(pct, label);
  if (text === "—") return <span className="text-stone-500">{text}</span>;
  const up = (pct ?? 0) > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className="inline-flex items-center gap-1 text-stone-600 dark:text-stone-400">
      <Icon size={14} aria-hidden />
      <span>{text} vs prior</span>
    </span>
  );
}

export function DailySummaryView({
  data,
  loading,
  error,
  onRetry,
  dateKey,
  timezone,
  compareMode,
  onCompareMode,
  onDateChange,
  onRefresh,
  updatedLabel,
  onPrint,
  onExport,
  onSendEmail,
  emailAvailable = true,
}: {
  data: DailySummaryPayload | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  dateKey: string;
  timezone: string;
  compareMode: CompareMode;
  onCompareMode: (m: CompareMode) => void;
  onDateChange: (next: string) => void;
  onRefresh: () => void;
  updatedLabel: string;
  onPrint: () => void;
  onExport: () => void;
  onSendEmail?: () => void;
  emailAvailable?: boolean;
}) {
  const [expandedDeals, setExpandedDeals] = useState<Set<string>>(new Set());
  const [lowStockOpen, setLowStockOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [printVariant, setPrintVariant] = useState<"a4" | "thermal">("a4");

  const heading = formatStoreDateHeading(dateKey, timezone);
  const statusChip = data ? dayStatusLabel(data.meta.status, data.meta.finalReasons) : "";

  const controlZeros = useMemo(() => {
    if (!data?.control) return true;
    const c = data.control;
    return (
      c.discounts.total === 0 &&
      c.voids.count === 0 &&
      c.refunds.total === 0 &&
      c.waste.total === 0
    );
  }, [data]);

  const paymentProof = data ? paymentSplitProof(data.money.paymentSplit) : null;

  return (
    <AdminPage className={`print:bg-white daily-summary-print daily-summary-print-${printVariant}`}>
      <AdminPageHeader
        title="Daily summary"
        description="End-of-day close-out for the selected store date."
        icon={Sun}
        iconAccent="brand"
        trailing={
          data ? (
            <span
              title={data.meta.statusHelp ?? undefined}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                data.meta.status === "final"
                  ? "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200"
                  : "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-100"
              }`}
            >
              {statusChip}
            </span>
          ) : null
        }
        actions={
          <div className="relative flex flex-wrap items-center gap-2 print:hidden">
            <button
              type="button"
              className="btn-ghost min-h-11 min-w-11"
              aria-label="Refresh"
              onClick={onRefresh}
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            <span className="hidden text-xs text-stone-500 md:inline" aria-live="polite">
              {updatedLabel}
            </span>
            <div className="hidden items-center gap-2 sm:flex">
              <select
                className="input min-h-11 py-2 text-xs"
                aria-label="Print layout"
                value={printVariant}
                onChange={(e) => setPrintVariant(e.target.value as "a4" | "thermal")}
              >
                <option value="a4">Print A4</option>
                <option value="thermal">Print 80mm</option>
              </select>
              {emailAvailable && onSendEmail && (
                <button type="button" className="btn-ghost min-h-11" onClick={onSendEmail}>
                  <Mail size={16} /> Email
                </button>
              )}
              <button type="button" className="btn-ghost min-h-11" onClick={onExport}>
                <Download size={16} /> Export CSV
              </button>
              <button type="button" className="btn-primary min-h-11" onClick={onPrint}>
                <Printer size={16} /> Print
              </button>
            </div>
            <button
              type="button"
              className="btn-ghost min-h-11 min-w-11 sm:hidden"
              aria-label="More actions"
              aria-expanded={actionsOpen}
              onClick={() => setActionsOpen((o) => !o)}
            >
              <MoreVertical size={18} />
            </button>
            {actionsOpen && (
              <div
                className="absolute right-0 top-full z-30 mt-1 w-48 rounded-xl border border-stone-200 bg-white p-1 shadow-lg dark:border-stone-700 dark:bg-stone-900 sm:hidden"
                role="menu"
              >
                {emailAvailable && onSendEmail && (
                  <button type="button" className="flex min-h-11 w-full items-center gap-2 px-3 text-sm" onClick={onSendEmail}>
                    <Mail size={16} /> Send test email
                  </button>
                )}
                <button type="button" className="flex min-h-11 w-full items-center gap-2 px-3 text-sm" onClick={onExport}>
                  <Download size={16} /> Export CSV
                </button>
                <button type="button" className="flex min-h-11 w-full items-center gap-2 px-3 text-sm" onClick={onPrint}>
                  <Printer size={16} /> Print
                </button>
              </div>
            )}
          </div>
        }
      />

      <div className="daily-summary-sticky flex flex-wrap items-center gap-2 print:hidden">
        <button
          type="button"
          className="btn-ghost min-h-11 min-w-11"
          aria-label="Previous day"
          onClick={() => onDateChange(shiftDate(dateKey, -1))}
        >
          <ChevronLeft size={18} />
        </button>
        <p className="min-w-[10rem] text-center text-sm font-semibold text-stone-800 dark:text-stone-100">
          {heading}
        </p>
        <button
          type="button"
          className="btn-ghost min-h-11 min-w-11"
          aria-label="Next day"
          onClick={() => onDateChange(shiftDate(dateKey, 1))}
        >
          <ChevronRight size={18} />
        </button>
        <button type="button" className="btn-ghost min-h-11 text-sm" onClick={() => onDateChange(todayKey(timezone))}>
          Today
        </button>
        <span className="text-xs text-stone-500">{data?.meta.branch.name}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-stone-500">Compare</span>
          {(["yesterday", "lastWeek", "none"] as CompareMode[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`min-h-11 rounded-full px-3 text-xs font-semibold ${
                compareMode === m
                  ? "bg-brand-600 text-white"
                  : "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200"
              }`}
              onClick={() => onCompareMode(m)}
            >
              {m === "yesterday" ? "Yesterday" : m === "lastWeek" ? "Same day last week" : "None"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <AdminAlert variant="error">
          {error}{" "}
          <button type="button" className="font-semibold underline" onClick={onRetry}>
            Retry
          </button>
        </AdminAlert>
      )}

      {loading && !data && <p className="text-sm text-stone-500" aria-live="polite">Loading…</p>}

      {data && (
        <div className={`space-y-5 ${loading ? "opacity-60" : ""}`}>
          <section aria-labelledby="ds-attention">
            <h2 id="ds-attention" className="mb-2 text-sm font-semibold text-stone-700 dark:text-stone-300">
              Needs attention
            </h2>
            {data.needsAttention.length === 0 ? (
              <AdminAlert variant={data.meta.status === "final" ? "success" : "neutral"}>
                {data.meta.status === "final" ? "All clear — day is final." : "No blockers flagged."}
              </AdminAlert>
            ) : (
              <ul className="space-y-2">
                {data.needsAttention.map((n) => (
                  <li key={n.type}>
                    <Link
                      href={n.link}
                      className={`flex min-h-11 items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
                        n.severity === "critical"
                          ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
                          : "border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900"
                      }`}
                    >
                      <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
                      <span>
                        <span className="font-semibold">{n.message}</span>
                        {n.count > 1 ? ` (${n.count})` : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <AdminSurface>
            <h2 className="text-sm font-semibold text-stone-800 dark:text-stone-100">Money</h2>
            <AdminKpiGrid className="mt-3">
              <AdminKpiCard
                label="Collected"
                value={pkr(data.money.collected.value)}
                hint={data.meta.definitions.collected}
                accent="emerald"
              />
              <AdminKpiCard
                label="Booked"
                value={pkr(data.money.booked.value)}
                hint={data.meta.definitions.booked}
                accent="brand"
              />
            </AdminKpiGrid>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-stone-600 dark:text-stone-400">
              <DeltaHint kpi={data.money.collected} mode={compareMode} />
              <DeltaHint kpi={data.money.booked} mode={compareMode} />
            </div>

            {!data.money.reconciles.collected && (
              <p className="mt-3 flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-100">
                <AlertTriangle size={16} />
                Does not add up: difference {pkr(Math.abs(data.money.reconciles.collectedDifference))} (collected vs
                payment split)
              </p>
            )}
            {!data.money.reconciles.booked && (
              <p className="mt-2 flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-100">
                <AlertTriangle size={16} />
                Does not add up: difference {pkr(Math.abs(data.money.reconciles.bookedDifference))} (booked vs collected
                + not yet collected)
              </p>
            )}

            {paymentProof && (
              <p className="mt-3 text-sm text-stone-700 dark:text-stone-300">
                Collected {pkr(data.money.collected.value)} = Cash {pkr(data.money.paymentSplit.cash)} + Card{" "}
                {pkr(data.money.paymentSplit.card)} + COD received {pkr(data.money.paymentSplit.codReceived)}
                {data.money.paymentSplit.unspecified > 0
                  ? ` + Unspecified ${pkr(data.money.paymentSplit.unspecified)}`
                  : ""}
              </p>
            )}

            {data.money.notYetCollected.total > 0 && (
              <div className="mt-3 text-sm">
                <p className="font-semibold">Not yet collected — {pkr(data.money.notYetCollected.total)}</p>
                <ul className="mt-1 list-disc pl-5 text-stone-600 dark:text-stone-400">
                  {data.money.notYetCollected.codDue > 0 && (
                    <li>
                      <Link href="/admin/orders?payment=cod">COD due {pkr(data.money.notYetCollected.codDue)}</Link>
                    </li>
                  )}
                  {data.money.notYetCollected.unpaid > 0 && (
                    <li>
                      <Link href="/admin/orders?payment=unpaid">Unpaid {pkr(data.money.notYetCollected.unpaid)}</Link>
                    </li>
                  )}
                  {data.money.notYetCollected.partial > 0 && (
                    <li>Partly paid balance {pkr(data.money.notYetCollected.partial)}</li>
                  )}
                </ul>
              </div>
            )}
          </AdminSurface>

          <MobileFold
            title={`Cash drawer (${data.cash.dayTotal.label})`}
            defaultOpen
          >
          <AdminSurface className="max-md:border-0 max-md:shadow-none max-md:p-0">
            <h2 className="text-sm font-semibold md:hidden">Cash drawer ({data.cash.dayTotal.label})</h2>
            <div className="mt-3 overflow-x-auto max-md:mt-0">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="text-xs font-medium text-stone-500">
                  <tr>
                    <th className="py-2 pr-2">Cashier</th>
                    <th className="py-2 pr-2">Opened</th>
                    <th className="py-2 pr-2">Expected</th>
                    <th className="py-2 pr-2">Counted</th>
                    <th className="py-2">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cash.shifts.map((s) => (
                    <tr key={s.id} className="border-t border-stone-100 dark:border-stone-800">
                      <td className="py-2 pr-2">
                        <Link href={`/admin/shifts/${s.id}`} className="font-medium text-brand-700 dark:text-brand-300">
                          {s.cashierName}
                        </Link>
                      </td>
                      <td className="py-2 pr-2 tabular-nums">{formatTime(s.openedAt, timezone)}</td>
                      <td className="py-2 pr-2 tabular-nums">{pkr(s.expectedCash)}</td>
                      <td className="py-2 pr-2 tabular-nums">{s.countedCash != null ? pkr(s.countedCash) : "—"}</td>
                      <td className="py-2 tabular-nums">{s.difference != null ? pkr(s.difference) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-sm text-stone-600">
              Day total expected {pkr(data.cash.dayTotal.expectedCash)}
              {data.cash.dayTotal.countedCash != null ? ` · counted ${pkr(data.cash.dayTotal.countedCash)}` : ""}
            </p>
          </AdminSurface>
          </MobileFold>

          <MobileFold title="Orders" summary={`${data.orders.total.value} placed`}>
          <AdminSurface className="max-md:border-0 max-md:shadow-none max-md:p-0">
            <h2 className="text-sm font-semibold md:hidden">Orders</h2>
            <p className="mt-2 text-sm text-stone-600 dark:text-stone-400 max-md:mt-0">
              {data.orders.total.value} placed · {data.orders.completed.value} completed · {data.orders.cancelled.value}{" "}
              cancelled · {data.orders.late.value} late · Delivery {data.orders.byType.delivery} · Takeaway{" "}
              {data.orders.byType.takeaway} · Dine-in {data.orders.byType.dineIn}
              {data.orders.peakHour
                ? ` · Peak ${formatHour(data.orders.peakHour.hour)} (${data.orders.peakHour.orders} orders)`
                : ""}
            </p>
          </AdminSurface>
          </MobileFold>

          <MobileFold title="Top items" summary={`${data.topItems.length} rows`}>
          <AdminSurface className="max-md:border-0 max-md:shadow-none max-md:p-0">
            <h2 className="text-sm font-semibold md:hidden">Top items</h2>
            <ul className="mt-2 divide-y divide-stone-100 dark:divide-stone-800 max-md:mt-0">
              {data.topItems.map((row) => (
                <li key={`${row.kind}-${row.id}`} className="py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium">
                      {row.name}
                      {row.kind === "deal" ? " (deal)" : ""}
                    </span>
                    <span className="tabular-nums text-stone-600">
                      {row.quantity} · {pkr(row.revenue)} · {row.share}%
                    </span>
                  </div>
                  {row.kind === "deal" && row.components?.length ? (
                    <button
                      type="button"
                      className="mt-1 flex min-h-11 items-center gap-1 text-xs font-medium text-brand-700 dark:text-brand-300"
                      onClick={() => toggleDeal(expandedDeals, setExpandedDeals, row.id)}
                    >
                      <ChevronDown
                        size={14}
                        className={expandedDeals.has(row.id) ? "rotate-180" : ""}
                        aria-hidden
                      />
                      Included in deal
                    </button>
                  ) : null}
                  {row.kind === "deal" && expandedDeals.has(row.id) && row.components && (
                    <ul className="ml-4 mt-1 text-xs text-stone-500">
                      {row.components.map((c) => (
                        <li key={c.name}>{c.name} × {c.quantity}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </AdminSurface>
          </MobileFold>

          {data.control && (
            <MobileFold title="Control" summary={controlZeros ? "None" : "Activity"}>
            <AdminSurface className="max-md:border-0 max-md:shadow-none max-md:p-0">
              <h2 className="text-sm font-semibold md:hidden">Control</h2>
              {controlZeros ? (
                <p className="mt-2 text-sm text-stone-600">No discounts, voids, refunds or waste today.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {data.control.discounts.total > 0 && (
                    <li>Discounts {pkr(data.control.discounts.total)} ({data.control.discounts.count})</li>
                  )}
                  {data.control.voids.count > 0 && <li>Voids {data.control.voids.count}</li>}
                  {data.control.refunds.total > 0 && <li>Refunds {pkr(data.control.refunds.total)}</li>}
                  {data.control.waste.total > 0 && <li>Waste {pkr(data.control.waste.total)}</li>}
                </ul>
              )}
            </AdminSurface>
            </MobileFold>
          )}

          {data.inventory.lowStockCount > 0 && (
            <AdminSurface>
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-between text-sm font-semibold"
                onClick={() => setLowStockOpen((o) => !o)}
              >
                Low stock ({data.inventory.lowStockCount} {pluralize(data.inventory.lowStockCount, "SKU")})
                <ChevronDown size={16} className={lowStockOpen ? "rotate-180" : ""} />
              </button>
              {lowStockOpen && (
                <ul className="mt-2 space-y-1 text-sm">
                  {data.inventory.lowStock.map((i) => (
                    <li key={i.itemId}>
                      <Link href={`/admin/inventory?lowStock=1`}>
                        {i.name} — {i.stock} {i.unit} (reorder {i.reorderLevel})
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </AdminSurface>
          )}

          {data.menuHygiene.duplicateLookingNames.length > 0 && (
            <AdminAlert variant="warning">
              Menu hygiene: {data.menuHygiene.note}{" "}
              <Link href="/admin/catalog/dishes" className="font-semibold underline">
                Open menu
              </Link>
            </AdminAlert>
          )}

          {data.orders.total.value === 0 && (
            <AdminEmptyState icon={Sun} title={`No orders on ${heading}`} description="Try another date or branch." />
          )}
        </div>
      )}
    </AdminPage>
  );
}

function MobileFold({
  title,
  summary,
  defaultOpen,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <details
        className="group rounded-2xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900 md:hidden"
        open={defaultOpen}
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-stone-800 dark:text-stone-100">
          <span>{title}</span>
          {summary ? <span className="text-xs font-medium text-stone-500">{summary}</span> : null}
        </summary>
        <div className="border-t border-stone-100 px-3 py-3 dark:border-stone-800">{children}</div>
      </details>
      <div className="hidden md:block">{children}</div>
    </>
  );
}

function shiftDate(dateKey: string, delta: number) {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function todayKey(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${day}`;
}

function formatTime(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(
    new Date(iso)
  );
}

function formatHour(h: number) {
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12} ${suffix}`;
}

function toggleDeal(set: Set<string>, update: (s: Set<string>) => void, id: string) {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  update(next);
}
