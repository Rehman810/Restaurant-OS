"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardList, LayoutGrid, Search, Sparkles, Table2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fetchAdminOrders, fetchRidersSummary } from "@/lib/admin-orders";
import { pkr } from "@/lib/format";
import {
  formatDateSpanLabel,
  QuickDatePreset,
  quickPresetRange,
} from "@/lib/order-dates";
import { STATUS_THEME } from "@/lib/admin-status";
import { Order, OrderStatus, STATUS_LABEL } from "@/lib/types";
import { usePoll } from "@/hooks/usePoll";
import { useLiveOrders } from "@/hooks/useLiveOrders";
import { PAGE_SIZE } from "@/lib/pagination";
import { Pagination } from "@/components/Pagination";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { OrderDateFilter } from "@/components/admin/OrderDateFilter";
import { OrderDetailSheet } from "@/components/admin/OrderDetailSheet";
import { OrderPanel } from "@/components/admin/OrderPanel";
import { OrderTable } from "@/components/admin/OrderTable";
import { AdminEmptyState, AdminPage, AdminPageHeader } from "@/components/admin/ui";
import { ManagerApprovalModal } from "@/components/admin/ManagerApprovalModal";

type OrderView = "grid" | "table";
const VIEW_KEY = "uff-orders-view";

const FILTERS: (OrderStatus | "ALL")[] = [
  "ALL",
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
];

const FILTER_THEME: Record<OrderStatus | "ALL", { dot: string; active: string; idle: string }> = {
  ALL: { dot: "bg-brand-500", active: "bg-stone-900 text-white shadow-md", idle: "bg-white text-stone-700 ring-stone-200" },
  PENDING_CONFIRMATION: {
    dot: STATUS_THEME.PENDING_CONFIRMATION.dot,
    active: "bg-orange-500 text-white shadow-md shadow-orange-200",
    idle: "bg-white text-orange-800 ring-orange-200",
  },
  CONFIRMED: { dot: STATUS_THEME.CONFIRMED.dot, active: "bg-amber-500 text-white shadow-md shadow-amber-200", idle: "bg-white text-amber-800 ring-amber-200" },
  PREPARING: { dot: STATUS_THEME.PREPARING.dot, active: "bg-blue-500 text-white shadow-md shadow-blue-200", idle: "bg-white text-blue-800 ring-blue-200" },
  READY: { dot: STATUS_THEME.READY.dot, active: "bg-teal-500 text-white shadow-md shadow-teal-200", idle: "bg-white text-teal-800 ring-teal-200" },
  COLLECTED: { dot: STATUS_THEME.COLLECTED.dot, active: "bg-emerald-500 text-white shadow-md shadow-emerald-200", idle: "bg-white text-emerald-800 ring-emerald-200" },
  SERVED: { dot: STATUS_THEME.SERVED.dot, active: "bg-emerald-600 text-white shadow-md shadow-emerald-200", idle: "bg-white text-emerald-900 ring-emerald-200" },
  OUT_FOR_DELIVERY: { dot: STATUS_THEME.OUT_FOR_DELIVERY.dot, active: "bg-violet-500 text-white shadow-md shadow-violet-200", idle: "bg-white text-violet-800 ring-violet-200" },
  DELIVERED: { dot: STATUS_THEME.DELIVERED.dot, active: "bg-emerald-500 text-white shadow-md shadow-emerald-200", idle: "bg-white text-emerald-800 ring-emerald-200" },
  CANCELLED: { dot: STATUS_THEME.CANCELLED.dot, active: "bg-stone-500 text-white shadow-md", idle: "bg-white text-stone-600 ring-stone-200" },
};

const DEFAULT_RANGE = quickPresetRange("today");

export default function AdminOrders() {
  const { user } = useAuth();
  const isManagerLike = user?.role === "ADMIN" || user?.role === "MANAGER";
  const [filter, setFilter] = useState<OrderStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(DEFAULT_RANGE.from);
  const [dateTo, setDateTo] = useState(DEFAULT_RANGE.to);
  const [datePreset, setDatePreset] = useState<QuickDatePreset | null>("today");
  const [view, setView] = useState<OrderView>("table");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === "grid" || saved === "table") setView(saved);
  }, []);

  function changeView(next: OrderView) {
    setView(next);
    localStorage.setItem(VIEW_KEY, next);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [filter, search, dateFrom, dateTo]);

  const load = useCallback(async () => {
    const [list, riders] = await Promise.all([
      fetchAdminOrders({
        limit: PAGE_SIZE.table,
        offset: (page - 1) * PAGE_SIZE.table,
        status: filter === "ALL" ? undefined : filter,
        search,
        from: dateFrom,
        to: dateTo,
      }),
      fetchRidersSummary(),
    ]);
    return { ...list, riders };
  }, [page, filter, search, dateFrom, dateTo]);

  const { data, loading, refreshing, refresh } = usePoll(load, 10000);
  useLiveOrders(refresh);
  const showSkeleton = loading && !data;

  const [cancelTarget, setCancelTarget] = useState<{ id: string } | null>(null);
  const [voidReasonCode, setVoidReasonCode] = useState("");
  const [voidReasonNote, setVoidReasonNote] = useState("");
  const [voidReasons, setVoidReasons] = useState<string[]>([]);

  useEffect(() => {
    void api<{ voidReasonOptions: string[] }>("/admin/approval/controls").then((c) => {
      const list = Array.isArray(c.voidReasonOptions) ? c.voidReasonOptions.map(String) : [];
      setVoidReasons(list);
    });
  }, []);

  async function setStatus(id: string, status: OrderStatus) {
    if (status === "CANCELLED") {
      setCancelTarget({ id });
      return;
    }
    await api(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    refresh();
  }

  async function submitCancel(approval?: { approverId: string; pin: string }) {
    if (!cancelTarget) return;
    await api(`/orders/${cancelTarget.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "CANCELLED",
        voidReasonCode,
        voidReasonNote,
        approval,
      }),
    });
    setCancelTarget(null);
    setVoidReasonCode("");
    setVoidReasonNote("");
    refresh();
  }

  async function assign(id: string, riderId: string) {
    await api(`/orders/${id}/assign`, { method: "PATCH", body: JSON.stringify({ riderId }) });
    refresh();
  }

  async function confirmOrder(id: string) {
    await api(`/orders/${id}/confirm`, { method: "PATCH" });
    refresh();
  }

  function handleDateChange(from: string, to: string, preset: QuickDatePreset | null) {
    setDateFrom(from);
    setDateTo(to);
    setDatePreset(preset);
  }

  const orders = data?.orders ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE.table));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE.table + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE.table, total);
  const counts: Record<string, number> = {
    ALL: Object.values(data?.statusCounts ?? {}).reduce((sum, n) => sum + n, 0),
    ...(data?.statusCounts ?? {}),
  };
  const filteredRevenue = data?.filteredTotal ?? 0;

  const activeCount =
    (counts.PENDING_CONFIRMATION || 0) +
    (counts.CONFIRMED || 0) +
    (counts.READY || 0) +
    (counts.PREPARING || 0) +
    (counts.OUT_FOR_DELIVERY || 0);
  const periodLabel = formatDateSpanLabel(dateFrom, dateTo);

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        title="Orders"
        description={`${periodLabel} · refreshes every 10s · click a row for IP & location`}
        icon={ClipboardList}
        actions={
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-xl bg-amber-50 px-3 py-2 ring-1 ring-amber-100 dark:bg-amber-950/40 dark:ring-amber-900/50">
              <p className="text-[11px] font-medium text-stone-500 dark:text-stone-400">Active</p>
              <p className="text-lg font-semibold text-amber-800 dark:text-amber-200">{activeCount}</p>
            </div>
            <div className="rounded-xl bg-stone-50 px-3 py-2 ring-1 ring-stone-200 dark:bg-stone-800 dark:ring-stone-700">
              <p className="text-[11px] font-medium text-stone-500 dark:text-stone-400">Showing</p>
              <p className="text-lg font-semibold text-stone-900 dark:text-stone-50">{total}</p>
            </div>
            <div className="rounded-xl bg-brand-50 px-3 py-2 ring-1 ring-brand-100 dark:bg-brand-950/40 dark:ring-brand-900/50">
              <p className="text-[11px] font-medium text-stone-500 dark:text-stone-400">Value</p>
              <p className="text-lg font-semibold text-brand-800 dark:text-brand-200">{pkr(filteredRevenue)}</p>
            </div>
          </div>
        }
      />

      <OrderDateFilter
        from={dateFrom}
        to={dateTo}
        activePreset={datePreset}
        onChange={handleDateChange}
        orderCount={counts.ALL || 0}
      />

      {/* Search + refresh */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            className="w-full rounded-2xl border border-stone-200 bg-white py-3 pl-11 pr-4 text-sm shadow-sm outline-none transition placeholder:text-stone-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            placeholder="Search order #, name, phone, address…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-2xl bg-stone-100 p-1 ring-1 ring-stone-200">
            <button
              type="button"
              onClick={() => changeView("table")}
              aria-pressed={view === "table"}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-bold transition ${
                view === "table" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"
              }`}
            >
              <Table2 size={15} /> Table
            </button>
            <button
              type="button"
              onClick={() => changeView("grid")}
              aria-pressed={view === "grid"}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-bold transition ${
                view === "grid" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"
              }`}
            >
              <LayoutGrid size={15} /> Grid
            </button>
          </div>
          <RefreshButton busy={loading || refreshing} onClick={refresh} variant="primary" />
        </div>
      </div>

      {/* Status filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => {
          const t = FILTER_THEME[f];
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold ring-1 transition ${
                active ? t.active : `${t.idle} hover:bg-stone-50`
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${active && f !== "ALL" ? "bg-white/90" : t.dot}`} />
              {f === "ALL" ? "All" : STATUS_LABEL[f]}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-white/20" : "bg-stone-100 text-stone-500"}`}>
                {counts[f] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {showSkeleton &&
        (view === "table" ? (
          <div className="skeleton h-80 rounded-2xl" />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-72 rounded-2xl" />
            ))}
          </div>
        ))}

      {!showSkeleton && total === 0 && (
        <AdminEmptyState
          icon={Sparkles}
          title="No orders match"
          description="Try a different date range, status filter, or place a test order from the storefront."
        />
      )}

      {!showSkeleton && total > 0 && view === "table" && (
        <>
        <OrderTable
          orders={orders}
          riders={data?.riders || []}
          onStatus={setStatus}
          onAssign={assign}
          onConfirm={confirmOrder}
          onSelect={setSelectedOrder}
        />
        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={total}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          onPageChange={setPage}
        />
        </>
      )}

      {selectedOrder && (
        <OrderDetailSheet order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}

      {!showSkeleton && total > 0 && view === "grid" && (
        <>
        <div className="grid gap-5 lg:grid-cols-2">
          {orders.map((o) => (
            <OrderPanel
              key={o.id}
              order={o}
              riders={data?.riders || []}
              onStatus={setStatus}
              onAssign={assign}
              onConfirm={confirmOrder}
              onSelect={() => setSelectedOrder(o)}
            />
          ))}
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={total}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          onPageChange={setPage}
        />
        </>
      )}

      {cancelTarget && isManagerLike && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-stone-950/50 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-5 shadow-xl dark:border-stone-600 dark:bg-stone-900">
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-50">Cancel order</h2>
            <label className="mt-4 block text-xs font-semibold uppercase text-stone-500">Reason</label>
            <select
              className="input mt-1 w-full"
              value={voidReasonCode}
              onChange={(e) => setVoidReasonCode(e.target.value)}
            >
              <option value="">Select…</option>
              {voidReasons.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <input
              className="input mt-2 w-full"
              placeholder="Optional note"
              value={voidReasonNote}
              onChange={(e) => setVoidReasonNote(e.target.value)}
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" className="btn-ghost" onClick={() => setCancelTarget(null)}>Back</button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void submitCancel()}
              >
                Confirm cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelTarget && !isManagerLike && (
        <ManagerApprovalModal
          open
          title="Manager approval to cancel"
          reasonOptions={voidReasons}
          reasonCode={voidReasonCode}
          reasonNote={voidReasonNote}
          onReasonCodeChange={setVoidReasonCode}
          onReasonNoteChange={setVoidReasonNote}
          onCancel={() => setCancelTarget(null)}
          onApproved={(r) => void submitCancel({ approverId: r.approverId, pin: r.pin })}
        />
      )}
    </AdminPage>
  );
}
