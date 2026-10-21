"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, LayoutDashboard, Receipt, TrendingUp, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { pkr } from "@/lib/format";
import { OrderStatus, nextOrderStatus, canMoveForward } from "@/lib/types";
import { useDashboardSummary } from "@/hooks/useDashboardSummary";
import {
  buildNeedsAttentionCards,
  compactCurrency,
  formatDelta,
  formatPaymentMethodLabel,
  formatStoreDateTime,
  greetingForTimezone,
  pluralizeCount,
  relativeMinutesLabel,
} from "@/lib/dashboard/helpers";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { AdminPage, AdminEmptyState } from "@/components/admin/ui";
import { DashboardHero } from "@/components/admin/dashboard/DashboardHero";
import { DashboardKpiCard } from "@/components/admin/dashboard/DashboardKpiCard";
import { DashboardAttentionCards } from "@/components/admin/dashboard/DashboardAttentionCards";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { ConfirmSheet } from "@/components/admin/ConfirmSheet";
import { PipelineFlow } from "@/components/admin/PipelineFlow";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { FulfillmentBadge } from "@/components/FulfillmentBadge";
import { DashboardAccordionSections } from "@/components/admin/dashboard/DashboardAccordionSections";
import {
  DashboardMobileMenu,
  DashboardSoundToggle,
  useDashboardSound,
} from "@/components/admin/dashboard/DashboardHeaderExtras";

const DashboardCharts = dynamic(
  () => import("./DashboardCharts").then((m) => ({ default: m.Last7DaysChart })),
  { ssr: false, loading: () => <div className="skeleton aspect-[16/9] min-h-[240px] rounded-2xl" /> }
);
const TodayHourlyChart = dynamic(
  () => import("./DashboardCharts").then((m) => ({ default: m.TodayHourlyChart })),
  { ssr: false, loading: () => <div className="skeleton aspect-[16/9] min-h-[220px] rounded-2xl" /> }
);

function twoFaDismissKey(userId: string) {
  return `ros-2fa-dismiss-until-${userId}`;
}

export function AdminDashboardView() {
  const { user } = useAuth();
  const store = useStore();
  const { data, loading, error, stale, live, refresh, lastUpdated, highlightOrderIds } = useDashboardSummary();
  const { soundOn, toggle: toggleSound } = useDashboardSound();
  const [compareMode, setCompareMode] = useState<"yesterday" | "week">("yesterday");
  const [confirmClose, setConfirmClose] = useState(false);
  const [twoFaHidden, setTwoFaHidden] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    try {
      const until = localStorage.getItem(twoFaDismissKey(user.id));
      setTwoFaHidden(until ? Date.now() < Number(until) : false);
    } catch {
      setTwoFaHidden(false);
    }
  }, [user?.id]);

  const showFinancials = data?.kpis.booked != null;

  const greeting = useMemo(
    () => greetingForTimezone(data?.timezone ?? store?.settings.timezone ?? "Asia/Karachi"),
    [data?.timezone, store?.settings.timezone]
  );

  const dateTimeLabel = useMemo(() => {
    const tz = data?.timezone ?? store?.settings.timezone ?? "Asia/Karachi";
    return formatStoreDateTime(tz);
  }, [data?.timezone, store?.settings.timezone]);

  const activeInProgress = useMemo(() => {
    if (!data) return 0;
    return data.pipeline.stages.reduce((s, st) => s + st.count, 0);
  }, [data]);

  async function assignRider(id: string, riderId: string) {
    await api(`/orders/${id}/assign`, { method: "PATCH", body: JSON.stringify({ riderId }) });
    refresh();
  }

  async function setStatus(id: string, status: OrderStatus, fulfillment: string) {
    const current = data?.incomingOrders.find((o) => o.id === id);
    if (current && !canMoveForward(current.status, status, fulfillment as "DELIVERY" | "PICKUP" | "DINE_IN")) {
      return;
    }
    await api(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    refresh();
  }

  const toggleOnlineOrdering = useCallback(async () => {
    const open = Boolean(data?.storeState.onlineOrderingOpen);
    await api("/settings", { method: "PATCH", body: JSON.stringify({ forceClosed: open }) });
    window.dispatchEvent(new Event("store-refresh"));
    refresh();
    setConfirmClose(false);
  }, [data?.storeState.onlineOrderingOpen, refresh]);

  if (loading && !data) {
    return (
      <AdminPage className="w-full min-w-0 pb-24 lg:pb-8">
        <div className="skeleton h-24 rounded-2xl" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
      </AdminPage>
    );
  }

  if (!data) {
    return (
      <AdminPage>
        <AdminEmptyState
          icon={LayoutDashboard}
          title="Dashboard unavailable"
          description={error ?? "Try again in a moment."}
          action={
            <button type="button" className="font-bold text-brand-700" onClick={() => refresh()}>
              Retry
            </button>
          }
        />
      </AdminPage>
    );
  }

  const confirmStage = data.pipeline.stages.find((s) => s.status === "PENDING_CONFIRMATION");
  const shiftWarningMins = data.thresholds.shiftOpenWarningHours * 60;
  let shiftsOldestStaleMinutes: number | null = null;
  if (data.shifts?.open.length) {
    const nowMs = Date.now();
    for (const s of data.shifts.open) {
      const mins = Math.floor((nowMs - new Date(s.openedAt).getTime()) / 60000);
      if (mins >= shiftWarningMins && (shiftsOldestStaleMinutes == null || mins > shiftsOldestStaleMinutes)) {
        shiftsOldestStaleMinutes = mins;
      }
    }
  }

  const needsAttention = buildNeedsAttentionCards({
    lateOrders: data.lateOrders,
    confirmCount: confirmStage?.count ?? 0,
    confirmOldestMinutes: confirmStage?.oldestMinutes ?? null,
    syncConflicts: data.syncConflicts,
    offlinePosEnabled: store?.settings.offlinePosEnabled === true,
    shiftsStaleCount: data.shifts?.staleCount ?? 0,
    shiftsOldestStaleMinutes,
    riderCashPendingCount: data.riderCash?.pendingCount ?? 0,
    riderCashOldestMinutes: data.riderCash?.oldestPendingMinutes ?? null,
    lowStockCount: data.lowStock.count,
    pendingBookings: data.dineIn.pendingBookingConfirmations,
    lowRatingCount: data.feedback.lowRatingCount,
  });

  const storeChip = data.storeState.onlineOrderingOpen
    ? "Online ordering: Open"
    : data.storeState.reason === "force_closed"
      ? "Online ordering: Closed (manual)"
      : `Online ordering: Closed${data.storeState.nextOpenLabel ? ` · opens ${data.storeState.nextOpenLabel}` : ""}`;

  const pipelineSteps = data.pipeline.stages.map((s) => ({
    label: s.label,
    count: s.count,
    href: `/admin/tracking?status=${s.status}`,
    late: s.late,
    color: s.late ? "bg-red-500" : "bg-brand-500",
    bg: s.late ? "bg-red-50/80 dark:bg-red-950/30" : "bg-brand-50/80 dark:bg-brand-950/20",
    ring: s.late ? "ring-red-200/60" : "ring-brand-200/60",
  }));

  const dismissTwoFa = () => {
    if (!user?.id) return;
    const days = data.thresholds.twoFaReminderDays ?? 7;
    try {
      localStorage.setItem(twoFaDismissKey(user.id), String(Date.now() + days * 86400000));
    } catch {
      /* ignore */
    }
    setTwoFaHidden(true);
  };

  const showTwoFa = user?.role === "ADMIN" && !user.totpEnabled && !twoFaHidden;

  const hourly = data.hourlySales?.today ?? [];

  const liveState = error ? "offline" : live;
  const updatedLabel = lastUpdated
    ? relativeMinutesLabel(Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 60000))
    : "—";

  return (
    <AdminPage
      data-testid="admin-dashboard"
      className={`w-full min-w-0 space-y-5 pb-[max(6rem,env(safe-area-inset-bottom))] lg:space-y-6 lg:pb-8 ${stale ? "opacity-85" : ""}`}
    >
      <DashboardHero
        greeting={`${greeting}${user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋`}
        subtitle={`${activeInProgress} orders in progress · ${data.pipeline.completedToday} completed today · POS & dine-in always available`}
        storeChip={storeChip}
        onlineOpen={data.storeState.onlineOrderingOpen}
        live={liveState}
        lastUpdatedLabel={updatedLabel}
        highlightMetric={
          showFinancials && data.kpis.booked
            ? {
                label: "Booked today",
                value: compactCurrency(data.kpis.booked.value),
                title: pkr(data.kpis.booked.value),
              }
            : undefined
        }
        actions={
          <>
            <DashboardSoundToggle soundOn={soundOn} onSoundToggle={toggleSound} variant="dark" />
            <DashboardMobileMenu live={liveState} onRefresh={refresh} soundOn={soundOn} onSoundToggle={toggleSound} />
            <button
              type="button"
              onClick={() => setConfirmClose(true)}
              className="min-h-11 rounded-2xl bg-white px-4 text-sm font-bold text-stone-900 shadow-md hover:bg-brand-50"
            >
              {data.storeState.onlineOrderingOpen ? "Close online ordering" : "Open online ordering"}
            </button>
            <RefreshButton busy={loading} onClick={refresh} variant="dark" className="!py-3" />
          </>
        }
      />

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900 dark:bg-amber-950/40">
          <p>{error}</p>
          <button type="button" className="font-bold underline" onClick={() => refresh()}>Retry</button>
        </div>
      )}

      {showTwoFa && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200/80 bg-brand-50/90 px-4 py-3 text-sm shadow-sm dark:border-brand-900 dark:bg-brand-950/35">
          <p>Two-factor sign-in is off for this admin account.</p>
          <div className="flex gap-2">
            <Link href="/admin/settings" className="font-bold underline">Set up authenticator</Link>
            <button type="button" className="text-xs font-semibold text-stone-500" onClick={dismissTwoFa}>Dismiss</button>
          </div>
        </div>
      )}

      <section aria-labelledby="needs-attention-heading">
        <h2 id="needs-attention-heading" className="mb-2 text-sm font-bold text-stone-700 dark:text-stone-300">
          Needs attention
        </h2>
        <DashboardAttentionCards cards={needsAttention} />
      </section>

      <section className="rounded-3xl border border-stone-200/70 bg-white/90 p-4 shadow-sm backdrop-blur-sm dark:border-stone-700/80 dark:bg-stone-900/90 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-stone-900 dark:text-stone-50">Key metrics</h2>
            {showFinancials && (
              <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                Booked = orders placed today · Collected = completed (delivered / picked up / served)
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-stone-500">Compare</span>
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${compareMode === "yesterday" ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900" : "bg-stone-100 dark:bg-stone-800"}`}
              onClick={() => setCompareMode("yesterday")}
            >
              Yesterday
            </button>
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${compareMode === "week" ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900" : "bg-stone-100 dark:bg-stone-800"}`}
              onClick={() => setCompareMode("week")}
            >
              Same day last week
            </button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          <DashboardKpiCard
            label="Orders today"
            value={String(data.kpis.ordersToday.value)}
            hint={formatDelta(
              compareMode === "yesterday" ? data.kpis.ordersToday.deltaYesterdayPercent : data.kpis.ordersToday.deltaSameWeekdayPercent,
              compareMode === "yesterday" ? data.kpis.ordersToday.deltaYesterdayLabel : data.kpis.ordersToday.deltaSameWeekdayLabel
            )}
            icon={ClipboardList}
            accent="sky"
            sparklineHours={hourly}
          />
          {showFinancials && data.kpis.booked && (
            <DashboardKpiCard
              label="Booked"
              value={compactCurrency(data.kpis.booked.value)}
              title={pkr(data.kpis.booked.value)}
              hint={`${formatDelta(
                compareMode === "yesterday" ? data.kpis.booked.deltaYesterdayPercent : data.kpis.booked.deltaSameWeekdayPercent,
                compareMode === "yesterday" ? data.kpis.booked.deltaYesterdayLabel : data.kpis.booked.deltaSameWeekdayLabel
              )} vs prior`}
              icon={Receipt}
              accent="brand"
            />
          )}
          {showFinancials && data.kpis.collected && (
            <DashboardKpiCard
              label="Collected"
              value={compactCurrency(data.kpis.collected.value)}
              title={pkr(data.kpis.collected.value)}
              hint={`${formatDelta(
                compareMode === "yesterday" ? data.kpis.collected.deltaYesterdayPercent : data.kpis.collected.deltaSameWeekdayPercent,
                compareMode === "yesterday" ? data.kpis.collected.deltaYesterdayLabel : data.kpis.collected.deltaSameWeekdayLabel
              )} vs prior`}
              icon={Wallet}
              accent="emerald"
            />
          )}
          {showFinancials && data.kpis.avgOrderValue && (
            <DashboardKpiCard
              label="Avg order value"
              value={pkr(data.kpis.avgOrderValue.value)}
              hint={formatDelta(
                compareMode === "yesterday" ? data.kpis.avgOrderValue.deltaYesterdayPercent : data.kpis.avgOrderValue.deltaSameWeekdayPercent,
                compareMode === "yesterday" ? data.kpis.avgOrderValue.deltaYesterdayLabel : data.kpis.avgOrderValue.deltaSameWeekdayLabel
              )}
              icon={TrendingUp}
              accent="violet"
            />
          )}
          <DashboardKpiCard
            label="Completed today"
            value={String(data.kpis.completedToday.value)}
            hint={formatDelta(
              compareMode === "yesterday" ? data.kpis.completedToday.deltaYesterdayPercent : data.kpis.completedToday.deltaSameWeekdayPercent,
              compareMode === "yesterday" ? data.kpis.completedToday.deltaYesterdayLabel : data.kpis.completedToday.deltaSameWeekdayLabel
            )}
            icon={LayoutDashboard}
            accent="amber"
          />
        </div>
      </section>

      <PipelineFlow active={activeInProgress} steps={pipelineSteps} completedToday={data.pipeline.completedToday} />

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-3xl border border-stone-200/70 bg-white p-5 shadow-sm dark:border-stone-700/80 dark:bg-stone-900/90">
          <h2 className="font-display text-lg font-semibold text-stone-900 dark:text-stone-50">Today by hour</h2>
          {data.hourlySales && (
            <TodayHourlyChart today={data.hourlySales.today} comparison={data.hourlySales.comparison} showMoney={showFinancials} />
          )}
        </div>
        <div className="rounded-3xl border border-stone-200/70 bg-white p-5 shadow-sm dark:border-stone-700/80 dark:bg-stone-900/90">
          <h2 className="font-display text-lg font-semibold text-stone-900 dark:text-stone-50">Last 7 days</h2>
          {data.last7Days && <DashboardCharts data={data.last7Days} showMoney={showFinancials} />}
        </div>
      </div>

      {showFinancials && data.sourceSplit && data.paymentSplit && (
        <div className="grid gap-4 sm:grid-cols-2">
          <SplitCard
            title="Sales by source"
            subtitle="Based on booked orders today"
            rows={[
              { label: "Online", value: data.sourceSplit.online },
              { label: "POS", value: data.sourceSplit.pos },
              { label: "Dine-in", value: data.sourceSplit.dineIn },
            ]}
          />
          <SplitCard
            title="Payment split"
            subtitle="Collected orders today (cash, card, COD received)"
            rows={[
              { label: "Cash", value: data.paymentSplit.cash },
              { label: "Card", value: data.paymentSplit.card },
              ...(data.paymentSplit.codReceived > 0
                ? [{ label: "COD received", value: data.paymentSplit.codReceived }]
                : []),
              ...(data.paymentSplit.unspecified > 0
                ? [{ label: "Unspecified", value: data.paymentSplit.unspecified }]
                : []),
            ]}
          />
        </div>
      )}

      <section className="rounded-3xl border border-stone-200/70 bg-white p-4 shadow-sm dark:border-stone-700/80 dark:bg-stone-900/90 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-stone-900 dark:text-stone-50">Incoming orders</h2>
          <Link href="/admin/orders" className="text-sm font-bold text-brand-700">All orders →</Link>
        </div>
        <div className="space-y-2">
          {data.incomingOrders.length === 0 ? (
            <AdminEmptyState icon={ClipboardList} title="No recent orders" description="New orders appear here with quick status actions." />
          ) : (
            data.incomingOrders.map((o) => {
              const next = nextOrderStatus(o.status, o.fulfillmentType);
              const showRider =
                o.fulfillmentType === "DELIVERY" &&
                o.status !== "PENDING_CONFIRMATION" &&
                o.status !== "DELIVERED" &&
                o.status !== "CANCELLED" &&
                Boolean(data.riders?.length);
              return (
                <article
                  key={o.id}
                  className={`rounded-2xl border bg-white p-4 dark:bg-stone-900 ${
                    highlightOrderIds.includes(o.id)
                      ? "border-brand-400 ring-2 ring-brand-200 dark:border-brand-600 dark:ring-brand-900"
                      : o.isLate
                        ? "border-red-300 dark:border-red-800"
                        : "border-stone-200 dark:border-stone-700"
                  }`}
                  aria-live="polite"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-stone-900 dark:text-stone-50">{o.orderNumber}</p>
                        <FulfillmentBadge type={o.fulfillmentType} />
                        <StatusBadge status={o.status} fulfillmentType={o.fulfillmentType} />
                      </div>
                      <p className="text-sm text-stone-500">
                        {o.customerName} · {pluralizeCount(o.itemCount, "item")} ·{" "}
                        {formatPaymentMethodLabel(o.paymentMethod)}
                      </p>
                      <p
                        className={`text-xs font-semibold ${o.isLate ? "text-red-600 dark:text-red-400" : "text-stone-400"}`}
                      >
                        {relativeMinutesLabel(o.minutesInStatus)} in status
                      </p>
                    </div>
                    <div className="flex flex-wrap items-end gap-2 sm:justify-end">
                      <p className="font-display text-lg font-bold text-brand-700">{pkr(o.total)}</p>
                      {showRider && data.riders && (
                        <AdminSelect
                          value={o.riderId || ""}
                          label="Rider"
                          aria-label={`Assign rider for ${o.orderNumber}`}
                          minWidth="min-w-[130px]"
                          placeholder="Assign rider"
                          options={data.riders.map((r) => ({ value: r.id, label: r.name }))}
                          onChange={(v) => v && assignRider(o.id, v)}
                        />
                      )}
                      {next && (
                        <button
                          type="button"
                          className="min-h-11 min-w-[44px] rounded-xl bg-stone-900 px-4 text-sm font-bold text-white dark:bg-stone-100 dark:text-stone-900"
                          onClick={() => setStatus(o.id, next, o.fulfillmentType)}
                        >
                          Mark {next.replace(/_/g, " ").toLowerCase()}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <DashboardAccordionSections data={data} showFinancials={showFinancials} />

      <ConfirmSheet
        open={confirmClose}
        title={data.storeState.onlineOrderingOpen ? "Close online ordering?" : "Open online ordering?"}
        message="Customers will not be able to place online orders while closed. POS and dine-in are not affected."
        confirmLabel={data.storeState.onlineOrderingOpen ? "Close now" : "Open now"}
        saving={false}
        onConfirm={() => void toggleOnlineOrdering()}
        onClose={() => setConfirmClose(false)}
      />
    </AdminPage>
  );
}

function SplitCard({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle?: string;
  rows: { label: string; value: number }[];
}) {
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  return (
    <div className="rounded-3xl border border-stone-200/70 bg-white p-5 shadow-sm dark:border-stone-700/80 dark:bg-stone-900/90">
      <h3 className="font-display text-lg text-stone-900 dark:text-stone-50">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{subtitle}</p>}
      <ul className="mt-3 space-y-2">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="flex justify-between text-sm font-semibold">
              <span>
                {r.label}{" "}
                <span className="text-xs font-medium text-stone-400">
                  ({Math.round((r.value / total) * 100)}%)
                </span>
              </span>
              <span>{pkr(r.value)}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
              <div className="h-full bg-brand-600" style={{ width: `${(r.value / total) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
