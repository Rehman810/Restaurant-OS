"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ClipboardList, Download, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  assignAdminOrderRider,
  bulkAdminOrders,
  fetchAdminOrdersDispatch,
  transitionAdminOrder,
} from "@/lib/admin-orders/api";
import {
  buildOrdersCsv,
  completedStatusCount,
  formatStoreTime12h,
} from "@/lib/admin-orders/helpers";
import type { AdminOrderRow, AdminOrdersSort } from "@/lib/admin-orders/types";
import { fetchRidersSummary } from "@/lib/admin-orders";
import { quickPresetRange, type QuickDatePreset } from "@/lib/order-dates";
import { OrderStatus } from "@/lib/types";
import { usePoll } from "@/hooks/usePoll";
import { useLiveOrders } from "@/hooks/useLiveOrders";
import { Pagination } from "@/components/Pagination";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { AdminEmptyState, AdminPage, AdminPageHeader } from "@/components/admin/ui";
import { ManagerApprovalModal } from "@/components/admin/ManagerApprovalModal";
import { ConfirmSheet } from "@/components/admin/ConfirmSheet";
import { OrdersFilterBar } from "./OrdersFilterBar";
import { OrdersDispatchTable } from "./OrdersDispatchTable";
import { OrdersDetailDrawer } from "./OrdersDetailDrawer";
import { OrdersActiveFilters, type ActiveFilterChip } from "./OrdersActiveFilters";
import { OrdersBulkBar } from "./OrdersBulkBar";
import { RiderPickerSheet } from "./RiderPickerSheet";
import { OrdersStatusBoard } from "./OrdersStatusBoard";
import { OrdersBoardTabs } from "./OrdersBoardTabs";
import { OrdersMobileCardList } from "./OrdersMobileCardList";
import { OrdersMobileFilterSheet } from "./OrdersMobileFilterSheet";
import { printKotForOrder } from "@/lib/print-kot";
import { pkr } from "@/lib/format";

const VIEW_KEY = "uff-orders-view";
const PAGE_SIZE = 25;
const BOARD_PAGE_SIZE = 100;

function parseViewParam(raw: string | null): "table" | "board" {
  if (raw === "board" || raw === "grid") return "board";
  if (raw === "table") return "table";
  return "table";
}

type StatusChip = OrderStatus | "ALL" | "COMPLETED";

const COMPLETED: OrderStatus[] = ["DELIVERED", "COLLECTED", "SERVED"];

function statusesForChip(chip: StatusChip): OrderStatus[] | undefined {
  if (chip === "ALL") return undefined;
  if (chip === "COMPLETED") return COMPLETED;
  return [chip];
}

function chipFromParams(raw: string | null): StatusChip {
  if (!raw || raw === "ALL") return "ALL";
  if (raw === "COMPLETED") return "COMPLETED";
  const statuses: OrderStatus[] = [
    "PENDING_CONFIRMATION",
    "CONFIRMED",
    "PREPARING",
    "READY",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "COLLECTED",
    "SERVED",
    "CANCELLED",
  ];
  if (statuses.includes(raw as OrderStatus)) return raw as OrderStatus;
  return "ALL";
}

export function OrdersDispatchPage() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isManagerLike = user?.role === "ADMIN" || user?.role === "MANAGER";

  const preset = (searchParams.get("preset") as QuickDatePreset) || "today";
  const from =
    searchParams.get("from") || quickPresetRange(preset === "custom" ? "today" : preset).from;
  const to = searchParams.get("to") || quickPresetRange(preset === "custom" ? "today" : preset).to;
  const q = searchParams.get("q") || "";
  const statusChip = chipFromParams(searchParams.get("status"));
  const typeFilter = (searchParams.get("type") as "ALL" | "DELIVERY" | "PICKUP" | "DINE_IN") || "ALL";
  const paymentFilter = (searchParams.get("payment") as "ALL" | "paid" | "unpaid" | "cod" | "partial") || "ALL";
  const sourceFilter = (searchParams.get("source") as "ALL" | "online" | "pos") || "ALL";
  const riderFilter = searchParams.get("riderId") || "";
  const sort = (searchParams.get("sort") as AdminOrdersSort) || (statusChip === "ALL" ? "lateFirst" : "newest");
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const view = parseViewParam(searchParams.get("view"));
  const pageSize = view === "board" ? BOARD_PAGE_SIZE : PAGE_SIZE;

  const [searchInput, setSearchInput] = useState(q);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResults, setBulkResults] = useState<string | null>(null);
  const [bulkCancelOpen, setBulkCancelOpen] = useState(false);
  const [bulkCancelReason, setBulkCancelReason] = useState("");
  const [riderPickerBulk, setRiderPickerBulk] = useState(false);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [liveMsg, setLiveMsg] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);

  const setQuery = useCallback(
    (patch: Record<string, string | undefined>) => {
      const p = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") p.delete(k);
        else p.set(k, v);
      }
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (searchInput !== q) setQuery({ q: searchInput || undefined, page: "1" });
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput, q, setQuery]);

  useEffect(() => {
    function onVis() {
      setTabHidden(document.hidden);
    }
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    const raw = searchParams.get("view");
    if (raw === "grid") setQuery({ view: "board" });
    else if (!raw) {
      try {
        const saved = localStorage.getItem(VIEW_KEY);
        if (saved === "board" || saved === "grid") setQuery({ view: "board" });
        else if (saved === "table") setQuery({ view: "table" });
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount for URL/localStorage view
  }, []);

  const pollEnabled = !tabHidden && !drawerId && !menuOpen;

  const load = useCallback(async () => {
    const [list, riders] = await Promise.all([
      fetchAdminOrdersDispatch({
        from,
        to,
        statuses: statusesForChip(statusChip),
        types: typeFilter === "ALL" ? undefined : [typeFilter],
        sources: sourceFilter === "ALL" ? undefined : [sourceFilter],
        payment: paymentFilter === "ALL" ? undefined : [paymentFilter],
        riderId: riderFilter || undefined,
        q,
        sort,
        page,
        pageSize,
      }),
      fetchRidersSummary(),
    ]);
    setLastUpdated(list.serverTime);
    return { list, riders };
  }, [from, to, statusChip, typeFilter, paymentFilter, sourceFilter, riderFilter, q, sort, page, pageSize]);

  useEffect(() => {
    setSelected(new Set());
  }, [page, from, to, statusChip, typeFilter, paymentFilter, sourceFilter, riderFilter, q]);

  const { data, loading, refreshing, error, refresh } = usePoll(load, 10000, pollEnabled);

  useLiveOrders(
    () => {
      if (pollEnabled) refresh();
    },
    undefined,
    undefined,
    {
      onCreated: (payload) => {
        setLiveMsg("New order received");
        const orderId = payload?.orderId;
        if (!orderId) return;
        setFlashIds((prev) => new Set(prev).add(orderId));
        window.setTimeout(() => {
          setFlashIds((prev) => {
            const next = new Set(prev);
            next.delete(orderId);
            return next;
          });
        }, 3000);
      },
    }
  );

  useEffect(() => {
    if (!liveMsg) return;
    const id = window.setTimeout(() => setLiveMsg(""), 5000);
    return () => window.clearTimeout(id);
  }, [liveMsg]);

  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [voidReasonCode, setVoidReasonCode] = useState("");
  const [voidReasonNote, setVoidReasonNote] = useState("");
  const [voidReasons, setVoidReasons] = useState<string[]>([]);
  const [cancelSaving, setCancelSaving] = useState(false);

  useEffect(() => {
    void api<{ voidReasonOptions: string[] }>("/admin/approval/controls").then((c) => {
      const list = Array.isArray(c.voidReasonOptions) ? c.voidReasonOptions.map(String) : [];
      setVoidReasons(list);
    });
  }, []);

  async function runAction(row: AdminOrderRow, action: AdminOrderRow["nextActions"][number]) {
    if (action.action === "cancel") {
      setCancelOrderId(row.id);
      return;
    }
    await transitionAdminOrder(row.id, { targetStatus: action.targetStatus });
    refresh();
  }

  async function submitCancel(approval?: { approverId: string; pin: string }) {
    if (!cancelOrderId) return;
    setCancelSaving(true);
    try {
      await transitionAdminOrder(cancelOrderId, {
        targetStatus: "CANCELLED",
        voidReasonCode,
        voidReasonNote,
        approval,
      });
      setCancelOrderId(null);
      setVoidReasonCode("");
      setVoidReasonNote("");
      refresh();
    } finally {
      setCancelSaving(false);
    }
  }

  async function assign(row: AdminOrderRow, riderId: string) {
    await assignAdminOrderRider(row.id, riderId);
    refresh();
  }

  function openDrawer(row: AdminOrderRow) {
    setDrawerId(row.id);
  }

  const activeFilterChips = useMemo((): ActiveFilterChip[] => {
    const chips: ActiveFilterChip[] = [];
    if (preset && preset !== "today") chips.push({ key: "preset", label: preset });
    if (q) chips.push({ key: "q", label: `Search: ${q}` });
    if (statusChip !== "ALL") chips.push({ key: "status", label: `Status: ${statusChip}` });
    if (typeFilter !== "ALL") chips.push({ key: "type", label: `Type: ${typeFilter}` });
    if (paymentFilter !== "ALL") chips.push({ key: "payment", label: `Payment: ${paymentFilter}` });
    if (sourceFilter !== "ALL") chips.push({ key: "source", label: `Source: ${sourceFilter}` });
    if (riderFilter) {
      const name = data?.riders.find((r) => r.id === riderFilter)?.name ?? "Rider";
      chips.push({ key: "riderId", label: `Rider: ${name}` });
    }
    return chips;
  }, [preset, q, statusChip, typeFilter, paymentFilter, sourceFilter, riderFilter, data?.riders]);

  function removeFilter(key: string) {
    const map: Record<string, Record<string, string | undefined>> = {
      preset: { preset: "today", from: quickPresetRange("today").from, to: quickPresetRange("today").to },
      q: { q: undefined },
      status: { status: undefined },
      type: { type: undefined },
      payment: { payment: undefined },
      source: { source: undefined },
      riderId: { riderId: undefined },
    };
    setQuery({ ...map[key], page: "1" });
    if (key === "q") setSearchInput("");
  }

  function clearAllFilters() {
    const t = quickPresetRange("today");
    setSearchInput("");
    setQuery({
      preset: "today",
      from: t.from,
      to: t.to,
      q: undefined,
      status: undefined,
      type: undefined,
      payment: undefined,
      source: undefined,
      riderId: undefined,
      page: "1",
      sort: "lateFirst",
    });
  }

  async function runBulk(
    action: "transition" | "assignRider" | "printKot" | "cancelStale",
    extra?: { targetStatus?: OrderStatus; riderId?: string; reason?: string; voidReasonCode?: string }
  ) {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkBusy(true);
    setBulkResults(null);
    try {
      const res = await bulkAdminOrders({
        ids,
        action,
        targetStatus: extra?.targetStatus,
        riderId: extra?.riderId,
        reason: extra?.reason,
        voidReasonCode: extra?.voidReasonCode,
      });
      const failed = res.results.filter((r) => !r.ok);
      setBulkResults(
        failed.length
          ? `${res.succeeded} succeeded, ${res.failed} failed: ${failed.map((f) => f.error).join("; ")}`
          : `${res.succeeded} orders updated`
      );
      if (action === "printKot") {
        for (const r of res.results.filter((x) => x.ok)) {
          try {
            await printKotForOrder(r.id);
          } catch {
            /* skip print errors per order */
          }
        }
      }
      setSelected(new Set());
      refresh();
    } finally {
      setBulkBusy(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (rows.every((r) => selected.has(r.id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.id)));
    }
  }

  function exportCsv() {
    if (!data?.list.rows.length) return;
    const csv = buildOrdersCsv(data.list.rows, {
      from,
      to,
      branchLabel: "Current branch",
      timezone: data.list.timezone,
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const summary = data?.list.summary;
  const rows = data?.list.rows ?? [];
  const total = data?.list.pagination.total ?? 0;
  const totalPages = data?.list.pagination.totalPages ?? 1;
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  const mobileFilterLabel =
    activeFilterChips.length > 0 ? `Filters (${activeFilterChips.length})` : "Filters & view";
  const tz = data?.list.timezone ?? "Asia/Karachi";

  const statusCounts = useMemo(() => {
    const c = summary?.statusCounts ?? {};
    return {
      ALL: Object.values(c).reduce((s, n) => s + n, 0),
      ...c,
      COMPLETED: summary ? completedStatusCount(summary) : 0,
    } as Record<string, number>;
  }, [summary]);

  const statusChips: { id: StatusChip; label: string }[] = [
    { id: "ALL", label: "All" },
    { id: "PENDING_CONFIRMATION", label: "Awaiting" },
    { id: "CONFIRMED", label: "Confirmed" },
    { id: "PREPARING", label: "Preparing" },
    { id: "READY", label: "Ready" },
    { id: "OUT_FOR_DELIVERY", label: "Out" },
    { id: "COMPLETED", label: "Completed" },
    { id: "CANCELLED", label: "Cancelled" },
  ];

  const chipClass = (active: boolean) =>
    active
      ? "bg-brand-50 text-brand-900 ring-brand-200 dark:bg-brand-950/50 dark:text-brand-100 dark:ring-brand-800"
      : "bg-white text-stone-700 ring-stone-200 opacity-100 dark:bg-stone-900 dark:text-stone-200 dark:ring-stone-700";

  const showSkeleton = loading && !data;

  return (
    <AdminPage className="space-y-4" data-testid="admin-orders-dispatch">
      <div aria-live="polite" className="sr-only">{liveMsg}</div>

      <AdminPageHeader
        title="Orders"
        description="Dispatch board — confirm, assign riders, and collect payment."
        icon={ClipboardList}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <HeaderTile label="Active" value={String(summary?.active ?? "—")} accent="sky" />
        <HeaderTile label="Late" value={String(summary?.late ?? "—")} tone="danger" />
        <HeaderTile label="Unpaid" value={String(summary?.unpaid ?? "—")} accent="amber" />
        <HeaderTile
          label="Booked"
          value={summary?.booked != null ? pkr(summary.booked) : "—"}
          title={summary?.bookedDefinition}
          accent="brand"
        />
      </div>

      <OrdersMobileFilterSheet
        open={mobileFiltersOpen}
        onOpen={() => setMobileFiltersOpen(true)}
        onClose={() => setMobileFiltersOpen(false)}
        compactLabel={mobileFilterLabel}
        preset={preset}
        from={from}
        to={to}
        search={searchInput}
        typeFilter={typeFilter}
        paymentFilter={paymentFilter}
        sourceFilter={sourceFilter}
        riderFilter={riderFilter}
        riders={data?.riders ?? []}
        view={view}
        onPreset={(p) => {
          const range = p === "custom" ? { from, to } : quickPresetRange(p);
          setQuery({
            preset: p,
            from: range.from,
            to: range.to,
            page: "1",
            sort: p === "today" && statusChip === "ALL" ? "lateFirst" : sort,
          });
        }}
        onCustomRange={(f, t) => setQuery({ preset: "custom", from: f, to: t, page: "1" })}
        onSearch={setSearchInput}
        onTypeFilter={(t) => setQuery({ type: t === "ALL" ? undefined : t, page: "1" })}
        onPaymentFilter={(p) => setQuery({ payment: p === "ALL" ? undefined : p, page: "1" })}
        onSourceFilter={(s) => setQuery({ source: s === "ALL" ? undefined : s, page: "1" })}
        onRiderFilter={(id) => setQuery({ riderId: id || undefined, page: "1" })}
        onView={(v) => {
          setQuery({ view: v, page: "1" });
          try {
            localStorage.setItem(VIEW_KEY, v);
          } catch {
            /* ignore */
          }
        }}
      />

      <OrdersFilterBar
        preset={preset}
        from={from}
        to={to}
        search={searchInput}
        typeFilter={typeFilter}
        paymentFilter={paymentFilter}
        sourceFilter={sourceFilter}
        riderFilter={riderFilter}
        riders={data?.riders ?? []}
        view={view}
        onPreset={(p) => {
          const range = p === "custom" ? { from, to } : quickPresetRange(p);
          setQuery({
            preset: p,
            from: range.from,
            to: range.to,
            page: "1",
            sort: p === "today" && statusChip === "ALL" ? "lateFirst" : sort,
          });
        }}
        onCustomRange={(f, t) => setQuery({ preset: "custom", from: f, to: t, page: "1" })}
        onSearch={setSearchInput}
        onTypeFilter={(t) => setQuery({ type: t === "ALL" ? undefined : t, page: "1" })}
        onPaymentFilter={(p) => setQuery({ payment: p === "ALL" ? undefined : p, page: "1" })}
        onSourceFilter={(s) => setQuery({ source: s === "ALL" ? undefined : s, page: "1" })}
        onRiderFilter={(id) => setQuery({ riderId: id || undefined, page: "1" })}
        onView={(v) => {
          setQuery({ view: v, page: "1" });
          try {
            localStorage.setItem(VIEW_KEY, v);
          } catch {
            /* ignore */
          }
        }}
      />

      <OrdersActiveFilters
        chips={activeFilterChips}
        onRemove={removeFilter}
        onClearAll={clearAllFilters}
      />

      <div className="rounded-2xl border border-stone-200/60 bg-white/80 p-3 shadow-sm backdrop-blur-sm dark:border-stone-700 dark:bg-stone-900/80">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">Filter by status</p>
          <div className="flex items-center gap-1.5">
            {lastUpdated && (
              <p className="hidden text-xs text-stone-500 sm:block">
                Updated {formatStoreTime12h(lastUpdated, tz)}
              </p>
            )}
            <RefreshButton
              busy={loading || refreshing}
              onClick={refresh}
              variant="ghost"
              showLabel={false}
            />
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-stone-200 px-2.5 text-xs font-bold text-stone-700 dark:border-stone-600 dark:text-stone-200"
              onClick={exportCsv}
            >
              <Download size={14} /> CSV
            </button>
          </div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {statusChips.map((chip) => {
            const active = statusChip === chip.id;
            const count = statusCounts[chip.id] ?? 0;
            const muted = count === 0 && chip.id !== "ALL";
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() =>
                  setQuery({
                    status: chip.id === "ALL" ? undefined : chip.id,
                    page: "1",
                    sort: chip.id === "ALL" ? "lateFirst" : "newest",
                  })
                }
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-bold ring-1 ${chipClass(active)} ${muted ? "opacity-50" : ""}`}
              >
                {chip.label}
                <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
          <button type="button" className="ml-2 font-bold underline" onClick={refresh}>Retry</button>
        </div>
      )}

      {liveMsg && (
        <p className="rounded-xl bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-900 dark:bg-brand-950/50 dark:text-brand-100">
          {liveMsg}
        </p>
      )}

      {bulkResults && (
        <p className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-2 text-sm dark:border-stone-700 dark:bg-stone-800">
          {bulkResults}
        </p>
      )}

      {showSkeleton && <div className="skeleton h-80 rounded-2xl" />}

      {!showSkeleton && total === 0 && (
        <AdminEmptyState
          icon={Sparkles}
          title="No orders match"
          description="Try a different date range or filter."
        />
      )}

      {!showSkeleton && total > 0 && view === "table" && (
        <>
          <div className={`hidden lg:block ${refreshing ? "opacity-60" : ""}`}>
            <OrdersDispatchTable
              rows={rows}
              riders={data?.riders ?? []}
              timeZone={tz}
              serverTime={data?.list.serverTime ?? new Date().toISOString()}
              role={user?.role}
              flashIds={flashIds}
              onAction={runAction}
              onCancel={(row) => setCancelOrderId(row.id)}
              onAssignRider={assign}
              onSelect={openDrawer}
              onMenuOpenChange={setMenuOpen}
              onOpenDuplicate={(id) => {
                const row = rows.find((r) => r.id === id);
                if (row) openDrawer(row);
              }}
              selectedIds={selected}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              dimmed={false}
            />
          </div>
          <OrdersMobileCardList
            rows={rows}
            serverTime={data?.list.serverTime ?? new Date().toISOString()}
            role={user?.role}
            flashIds={flashIds}
            selectedIds={selected}
            onOpen={openDrawer}
            onAction={runAction}
            onLongPress={(row) => toggleSelect(row.id)}
          />
          <OrdersBulkBar
            count={selected.size}
            busy={bulkBusy}
            onClear={() => setSelected(new Set())}
            onMarkPreparing={() => void runBulk("transition", { targetStatus: "PREPARING" })}
            onPrintKot={() => void runBulk("printKot")}
            onAssignRider={() => setRiderPickerBulk(true)}
            onCancelStale={() => setBulkCancelOpen(true)}
          />
          <p className="text-center text-xs text-stone-500">
            Showing {rangeStart}–{rangeEnd} of {total}
          </p>
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={total}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onPageChange={(p) => setQuery({ page: String(p) })}
          />
        </>
      )}

      {!showSkeleton && total > 0 && view === "board" && (
        <>
          <div className={`hidden lg:block ${refreshing ? "opacity-60" : ""}`}>
            <OrdersStatusBoard
              rows={rows}
              timeZone={tz}
              serverTime={data?.list.serverTime ?? new Date().toISOString()}
              role={user?.role}
              flashIds={flashIds}
              onOpen={openDrawer}
              onAction={runAction}
            />
          </div>
          <OrdersBoardTabs
            rows={rows}
            timeZone={tz}
            serverTime={data?.list.serverTime ?? new Date().toISOString()}
            role={user?.role}
            flashIds={flashIds}
            onOpen={openDrawer}
            onAction={runAction}
            onLongPress={(row) => toggleSelect(row.id)}
            selectedIds={selected}
          />
          {totalPages > 1 && (
            <>
              <p className="text-center text-xs text-stone-500 lg:hidden">
                Showing {rangeStart}–{rangeEnd} of {total}
              </p>
              <Pagination
                page={page}
                totalPages={totalPages}
                totalItems={total}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                onPageChange={(p) => setQuery({ page: String(p) })}
              />
            </>
          )}
          {totalPages > 1 && (
            <p className="hidden text-center text-xs text-stone-500 lg:block">
              Showing up to {BOARD_PAGE_SIZE} orders per page ({rangeStart}–{rangeEnd} of {total})
            </p>
          )}
        </>
      )}

      {drawerId && (
        <OrdersDetailDrawer
          orderId={drawerId}
          timeZone={tz}
          role={user?.role}
          riders={data?.riders ?? []}
          onClose={() => setDrawerId(null)}
          onAction={async (detail, action) => {
            if (action.action === "cancel") {
              setCancelOrderId(detail.id);
              return;
            }
            await transitionAdminOrder(detail.id, { targetStatus: action.targetStatus });
            refresh();
          }}
          onAssignRider={async (id, riderId) => {
            await assignAdminOrderRider(id, riderId);
            refresh();
          }}
          onCancel={(detail) => setCancelOrderId(detail.id)}
        />
      )}

      <RiderPickerSheet
        open={riderPickerBulk}
        title="Assign rider to selected orders"
        riders={data?.riders ?? []}
        onClose={() => setRiderPickerBulk(false)}
        onSelect={(riderId) => {
          setRiderPickerBulk(false);
          void runBulk("assignRider", { riderId });
        }}
      />

      <ConfirmSheet
        open={bulkCancelOpen}
        title="Cancel stale orders"
        danger
        message={
          <ul className="list-disc pl-4 text-sm">
            {rows
              .filter((r) => selected.has(r.id))
              .map((r) => (
                <li key={r.id}>{r.shortDisplay} · {r.customer.name}</li>
              ))}
          </ul>
        }
        reasonLabel="Cancellation reason"
        reasonRequired
        saving={bulkBusy}
        onClose={() => setBulkCancelOpen(false)}
        onConfirm={(reason) => {
          setBulkCancelOpen(false);
          void runBulk("cancelStale", { reason, voidReasonCode: reason ?? "" });
        }}
      />

      {cancelOrderId && isManagerLike && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-stone-950/50 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-5 shadow-xl dark:border-stone-600 dark:bg-stone-900">
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-50">Cancel order</h2>
            <label className="mt-4 block text-xs font-semibold uppercase text-stone-500">Reason</label>
            <select
              className="input mt-1 w-full min-h-[44px]"
              value={voidReasonCode}
              onChange={(e) => setVoidReasonCode(e.target.value)}
            >
              <option value="">Select…</option>
              {voidReasons.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <input
              className="input mt-2 w-full min-h-[44px]"
              placeholder="Optional note"
              value={voidReasonNote}
              onChange={(e) => setVoidReasonNote(e.target.value)}
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" className="btn-ghost min-h-[44px]" onClick={() => setCancelOrderId(null)}>Back</button>
              <button
                type="button"
                className="btn-primary min-h-[44px]"
                disabled={!voidReasonCode || cancelSaving}
                onClick={() => void submitCancel()}
              >
                Confirm cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelOrderId && !isManagerLike && (
        <ManagerApprovalModal
          open
          title="Manager approval to cancel"
          reasonOptions={voidReasons}
          reasonCode={voidReasonCode}
          reasonNote={voidReasonNote}
          onReasonCodeChange={setVoidReasonCode}
          onReasonNoteChange={setVoidReasonNote}
          onCancel={() => setCancelOrderId(null)}
          onApproved={(r) => void submitCancel({ approverId: r.approverId, pin: r.pin })}
        />
      )}
    </AdminPage>
  );
}

function HeaderTile({
  label,
  value,
  title,
  tone,
  accent = "stone",
}: {
  label: string;
  value: string;
  title?: string;
  tone?: "danger";
  accent?: "stone" | "brand" | "sky" | "amber";
}) {
  const accents = {
    stone: "from-stone-50 to-white ring-stone-200/80 dark:from-stone-800 dark:to-stone-900 dark:ring-stone-700",
    brand: "from-brand-50/80 to-white ring-brand-100 dark:from-brand-950/30 dark:to-stone-900 dark:ring-brand-900/40",
    sky: "from-sky-50/80 to-white ring-sky-100 dark:from-sky-950/30 dark:to-stone-900 dark:ring-sky-900/40",
    amber: "from-amber-50/80 to-white ring-amber-100 dark:from-amber-950/30 dark:to-stone-900 dark:ring-amber-900/40",
  };
  return (
    <div
      title={title}
      className={`rounded-2xl bg-gradient-to-br px-4 py-3 shadow-sm ring-1 ${
        tone === "danger"
          ? "from-red-50 to-white ring-red-200/80 dark:from-red-950/40 dark:to-stone-900 dark:ring-red-900/50"
          : accents[accent]
      }`}
    >
      <p className="text-xs font-medium text-stone-500 dark:text-stone-400">{label}</p>
      <p
        className={`mt-0.5 font-display text-2xl font-bold tracking-tight ${
          tone === "danger" ? "text-red-700 dark:text-red-200" : "text-stone-900 dark:text-stone-50"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
