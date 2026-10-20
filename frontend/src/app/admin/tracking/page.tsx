"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Map, Maximize2, Minimize2, Users } from "lucide-react";
import { KitchenUndoToast } from "@/components/admin/kitchen/KitchenUndoToast";
import { useAuth } from "@/lib/auth";
import { usePoll } from "@/hooks/usePoll";
import { useLiveOrders } from "@/hooks/useLiveOrders";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { OrderBoard, RiderPanel } from "@/components/admin/order-board";
import { TrackingFilterSheet } from "@/components/admin/order-board/TrackingFilterSheet";
import { OrdersDetailDrawer } from "@/components/admin/orders/OrdersDetailDrawer";
import { RiderPickerSheet } from "@/components/admin/orders/RiderPickerSheet";
import { UnassignedOrderPickerSheet } from "@/components/admin/orders/UnassignedOrderPickerSheet";
import { TrackingBulkBar } from "@/components/admin/orders/TrackingBulkBar";
import {
  assignAdminOrderRider,
  bulkAdminOrders,
  transitionAdminOrder,
} from "@/lib/admin-orders/api";
import {
  cancelledFromTracking,
  collectUnassignedDeliveries,
  columnsFromTrackingResponse,
  fetchTrackingBoard,
  fetchTrackingRiders,
  trackingRidersToPickerRiders,
} from "@/lib/admin-orders/tracking";
import { formatStoreTime12h } from "@/lib/admin-orders/helpers";
import type { AdminOrderRow } from "@/lib/admin-orders/types";
import type { FulfillmentType } from "@/lib/types";
import { pkr } from "@/lib/format";
import { readTrackingTv, setTrackingTv } from "@/lib/tracking/display";
import { canDropOnColumn, targetStatusForBoardColumn } from "@/lib/admin-orders/board-dnd";
import type { BoardColumnId } from "@/lib/admin-orders/board-columns";
import type { OrderStatus } from "@/lib/types";

type ConnState = "connected" | "reconnecting" | "offline";
type MobilePane = "board" | "riders";

type BoardUndo = {
  orderId: string;
  label: string;
  from: OrderStatus;
  to: OrderStatus;
  expiresAt: number;
};

export default function TrackingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const typeParam = searchParams.get("type") as FulfillmentType | "ALL" | null;
  const riderId = searchParams.get("riderId") || "";
  const lateOnly = searchParams.get("lateOnly") === "true";
  const filter = searchParams.get("filter") || "";
  const paneParam = searchParams.get("pane") as MobilePane | null;

  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [riderPickRow, setRiderPickRow] = useState<AdminOrderRow | null>(null);
  const [assignTargetRiderId, setAssignTargetRiderId] = useState<string | null>(null);
  const [bulkRiderOpen, setBulkRiderOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [liveMsg, setLiveMsg] = useState("");
  const [conn, setConn] = useState<ConnState>("offline");
  const [tabHidden, setTabHidden] = useState(false);
  const [mobilePane, setMobilePane] = useState<MobilePane>(paneParam === "riders" ? "riders" : "board");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tvMode, setTvMode] = useState(false);
  const [boardUndo, setBoardUndo] = useState<BoardUndo | null>(null);

  const canAssignRider = user?.role === "ADMIN" || user?.role === "MANAGER";
  const canMoveCard =
    user?.role === "ADMIN" ||
    user?.role === "MANAGER" ||
    user?.role === "CASHIER" ||
    user?.role === "CHEF";

  useEffect(() => {
    const sync = () => setTvMode(readTrackingTv() || searchParams.get("tv") === "1");
    sync();
    window.addEventListener("tracking-tv-change", sync);
    return () => window.removeEventListener("tracking-tv-change", sync);
  }, [searchParams]);

  async function toggleTvMode() {
    const next = !tvMode;
    setTrackingTv(next);
    setTvMode(next);
    if (next) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        /* optional */
      }
    } else if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => null);
    }
  }

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
    const onVis = () => setTabHidden(document.hidden);
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const sheetOpen =
    Boolean(riderPickRow) || Boolean(assignTargetRiderId) || bulkRiderOpen || filtersOpen;
  const pollEnabled = !tabHidden && !drawerId && !sheetOpen;

  const load = useCallback(async () => {
    const types =
      typeParam && typeParam !== "ALL" ? [typeParam as FulfillmentType] : undefined;
    const [board, riderPanel] = await Promise.all([
      fetchTrackingBoard({
        types,
        riderId: riderId || undefined,
        lateOnly: lateOnly || filter === "late",
      }),
      fetchTrackingRiders(),
    ]);
    return { board, riderPanel };
  }, [typeParam, riderId, lateOnly, filter]);

  const { data, loading, refreshing, error, refresh } = usePoll(load, 8000, pollEnabled);

  useLiveOrders(
    () => {
      if (pollEnabled) refresh();
    },
    undefined,
    undefined,
    {
      onCreated: (payload) => {
        setLiveMsg("New order");
        const orderId = payload?.orderId;
        if (!orderId) return;
        setFlashIds((prev) => new Set(prev).add(orderId));
        window.setTimeout(() => {
          setFlashIds((prev) => {
            const next = new Set(prev);
            next.delete(orderId);
            return next;
          });
        }, 2500);
      },
      onConnectChange: (connected) => {
        setConn(connected ? "connected" : "reconnecting");
      },
    }
  );

  useEffect(() => {
    if (!liveMsg) return;
    const id = window.setTimeout(() => setLiveMsg(""), 4000);
    return () => window.clearTimeout(id);
  }, [liveMsg]);

  const tz = data?.board.timezone ?? "Asia/Karachi";
  const summary = data?.board.summary;
  const trackingRiders = data?.riderPanel.riders ?? [];
  const pickerRiders = useMemo(
    () => trackingRidersToPickerRiders(trackingRiders),
    [trackingRiders]
  );

  const columns = useMemo(() => {
    if (!data?.board) return [];
    const base = columnsFromTrackingResponse(data.board);
    if (!filter || filter === "active") return base;
    const match = (row: AdminOrderRow) => {
      if (filter === "late") return row.isLate;
      if (filter === "stale") return row.isStale;
      if (filter === "unassigned") return Boolean(row.needsRider);
      return true;
    };
    return base.map((col) => {
      const cards = col.cards.filter(match);
      return { ...col, cards, count: cards.length };
    });
  }, [data?.board, filter]);

  const cancelled = useMemo(
    () => (data?.board ? cancelledFromTracking(data.board) : []),
    [data?.board]
  );

  const unassignedDeliveries = useMemo(
    () => collectUnassignedDeliveries(columns),
    [columns]
  );

  const assignTargetRider = trackingRiders.find((r) => r.id === assignTargetRiderId);

  const selectedDeliveryIds = useMemo(
    () =>
      [...selected].filter((id) => {
        for (const col of columns) {
          const row = col.cards.find((c) => c.id === id);
          if (row?.type === "DELIVERY") return true;
        }
        return false;
      }),
    [selected, columns]
  );

  async function runAction(row: AdminOrderRow, action: AdminOrderRow["nextActions"][number]) {
    const from = row.status;
    try {
      await transitionAdminOrder(row.id, { targetStatus: action.targetStatus });
      if (action.targetStatus && action.targetStatus !== from) {
        setBoardUndo({
          orderId: row.id,
          label: row.shortDisplay,
          from,
          to: action.targetStatus,
          expiresAt: Date.now() + 8000,
        });
      }
      refresh();
    } catch (e) {
      setBulkMsg(e instanceof Error ? e.message : "Could not update order");
    }
  }

  async function runMoveCard(orderId: string, columnId: BoardColumnId) {
    const row = columns.flatMap((c) => c.cards).find((c) => c.id === orderId);
    if (!row || !canDropOnColumn(columnId, row)) return;
    const target = targetStatusForBoardColumn(columnId, row);
    if (!target || target === row.status) return;
    const from = row.status;
    try {
      await transitionAdminOrder(orderId, { targetStatus: target });
      setBoardUndo({
        orderId,
        label: row.shortDisplay,
        from,
        to: target,
        expiresAt: Date.now() + 8000,
      });
      refresh();
    } catch (e) {
      setBulkMsg(e instanceof Error ? e.message : "Could not move order");
    }
  }

  async function undoBoardMove() {
    if (!boardUndo) return;
    const snap = boardUndo;
    setBoardUndo(null);
    try {
      await transitionAdminOrder(snap.orderId, { targetStatus: snap.from, boardUndo: true });
      refresh();
    } catch (e) {
      setBulkMsg(e instanceof Error ? e.message : "Could not undo move");
    }
  }

  function toggleSelect(row: AdminOrderRow) {
    if (row.type !== "DELIVERY") return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(row.id)) next.delete(row.id);
      else next.add(row.id);
      return next;
    });
  }

  async function runBulkAssign(riderId: string) {
    const ids = selectedDeliveryIds;
    if (!ids.length) return;
    setBulkBusy(true);
    setBulkMsg(null);
    try {
      const res = await bulkAdminOrders({ ids, action: "assignRider", riderId });
      const failed = res.results.filter((r) => !r.ok);
      setBulkMsg(
        failed.length
          ? `${res.succeeded} assigned, ${res.failed} failed: ${failed.map((f) => f.error).join("; ")}`
          : `${res.succeeded} deliveries assigned`
      );
      setSelected(new Set());
      refresh();
    } finally {
      setBulkBusy(false);
      setBulkRiderOpen(false);
    }
  }

  const showSkeleton = loading && !data;

  function summaryChip(
    key: string,
    label: string,
    value: string | number,
    active: boolean,
    title?: string
  ) {
    return (
      <button
        type="button"
        title={title}
        className={`min-h-[44px] rounded-xl px-3 py-2 text-left ring-1 transition ${
          active
            ? "bg-brand-50 ring-brand-200 dark:bg-brand-950/40 dark:ring-brand-800"
            : "bg-white ring-stone-200 hover:bg-stone-50 dark:bg-stone-900 dark:ring-stone-700"
        }`}
        onClick={() => setQuery({ filter: active ? undefined : key })}
      >
        <p className="text-[10px] font-semibold uppercase text-stone-500">{label}</p>
        <p className="text-lg font-bold text-stone-900 dark:text-stone-50">{value}</p>
      </button>
    );
  }

  function setMobilePaneAndUrl(pane: MobilePane) {
    setMobilePane(pane);
    setQuery({ pane: pane === "board" ? undefined : pane });
  }

  const typeFilter = (typeParam || "ALL") as FulfillmentType | "ALL";

  return (
    <div
      className="flex min-h-0 max-w-full flex-1 flex-col gap-2 overflow-x-hidden pb-4"
      data-testid="admin-tracking-board"
    >
      <div aria-live="polite" className="sr-only">
        {liveMsg}
        {conn === "offline" ? "Disconnected" : conn === "connected" ? "Connected" : "Reconnecting"}
      </div>

      {conn !== "connected" && (
        <div
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          {conn === "offline"
            ? "Disconnected: orders are not updating. Check your network."
            : "Reconnecting… orders may be stale until live again."}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200/80 bg-white px-3 py-2 dark:border-stone-700 dark:bg-stone-900">
        <div className="flex items-center gap-2">
          <Map size={18} className="text-brand-600 dark:text-brand-400" aria-hidden />
          <div>
            <h1 className="text-base font-semibold text-stone-900 dark:text-stone-50">Live board</h1>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Real-time pipeline · no live map (rider GPS not reported by the app).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="hidden items-center gap-1.5 text-xs text-stone-500 sm:inline-flex"
            title={conn === "connected" ? "Socket connected" : "Using polling fallback"}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                conn === "connected" ? "bg-emerald-500" : conn === "reconnecting" ? "bg-amber-500" : "bg-stone-400"
              }`}
              aria-hidden
            />
            {conn === "connected" ? "Connected" : conn === "reconnecting" ? "Reconnecting" : "Offline"}
          </span>
          {data?.board.serverTime && (
            <span className="text-xs text-stone-500">
              Updated {formatStoreTime12h(data.board.serverTime, tz)}
            </span>
          )}
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center gap-1 rounded-xl px-2 text-xs font-bold text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50 dark:text-stone-300 dark:ring-stone-600"
            onClick={() => void toggleTvMode()}
            title={tvMode ? "Exit TV mode" : "TV mode"}
          >
            {tvMode ? <Minimize2 size={16} aria-hidden /> : <Maximize2 size={16} aria-hidden />}
            <span className="hidden sm:inline">{tvMode ? "Exit TV" : "TV"}</span>
          </button>
          <RefreshButton busy={loading || refreshing} onClick={refresh} variant="ghost" showLabel={false} />
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {summaryChip("active", "Active", summary.active, filter === "active")}
          {summaryChip("late", "Late", summary.late, filter === "late" || lateOnly)}
          {summaryChip("stale", "Stale", summary.stale, filter === "stale")}
          {summaryChip(
            "unassigned",
            "Unassigned",
            summary.unassignedDeliveries,
            filter === "unassigned"
          )}
          <div
            className="min-h-[44px] rounded-xl bg-stone-50 px-3 py-2 ring-1 ring-stone-200 dark:bg-stone-800/50 dark:ring-stone-700"
            title={summary.pipelineValueDefinition}
          >
            <p className="text-[10px] font-semibold uppercase text-stone-500">Pipeline value</p>
            <p className="text-lg font-bold text-stone-900 dark:text-stone-50">{pkr(summary.pipelineValue)}</p>
          </div>
        </div>
      )}

      <div className="lg:hidden">
        <TrackingFilterSheet
          open={filtersOpen}
          onOpen={() => setFiltersOpen(true)}
          onClose={() => setFiltersOpen(false)}
          typeParam={typeFilter}
          lateOnly={lateOnly}
          riderId={riderId}
          riders={pickerRiders}
          onType={(t) => {
            setQuery({ type: t === "ALL" ? undefined : t });
            setFiltersOpen(false);
          }}
          onLateOnly={(v) => {
            setQuery({ lateOnly: v ? "true" : undefined, filter: undefined });
            setFiltersOpen(false);
          }}
          onRider={(id) => {
            setQuery({ riderId: id || undefined });
            setFiltersOpen(false);
          }}
        />
      </div>

      <div className="hidden flex-wrap gap-2 text-xs lg:flex">
        {(["ALL", "DELIVERY", "PICKUP", "DINE_IN"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`min-h-[44px] rounded-full px-3 py-2 font-bold ring-1 ${
              (typeParam || "ALL") === t
                ? "bg-brand-50 text-brand-900 ring-brand-200"
                : "bg-white text-stone-600 ring-stone-200 dark:bg-stone-900"
            }`}
            onClick={() => setQuery({ type: t === "ALL" ? undefined : t })}
          >
            {t === "ALL" ? "All types" : t.replace("_", " ")}
          </button>
        ))}
        <button
          type="button"
          className={`min-h-[44px] rounded-full px-3 py-2 font-bold ring-1 ${
            lateOnly ? "bg-red-50 text-red-900 ring-red-200" : "bg-white ring-stone-200"
          }`}
          onClick={() => setQuery({ lateOnly: lateOnly ? undefined : "true", filter: undefined })}
        >
          Late only
        </button>
        {riderId && (
          <button
            type="button"
            className="min-h-[44px] rounded-full bg-brand-50 px-3 py-2 font-bold text-brand-900 ring-1 ring-brand-200"
            onClick={() => setQuery({ riderId: undefined })}
          >
            Clear rider filter
          </button>
        )}
      </div>

      <div className="flex gap-1 lg:hidden">
        <button
          type="button"
          className={`flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-xl text-sm font-bold ring-1 ${
            mobilePane === "board"
              ? "bg-brand-50 text-brand-900 ring-brand-200"
              : "bg-white ring-stone-200 dark:bg-stone-900"
          }`}
          onClick={() => setMobilePaneAndUrl("board")}
        >
          <Map size={16} aria-hidden /> Board
        </button>
        <button
          type="button"
          className={`flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-xl text-sm font-bold ring-1 ${
            mobilePane === "riders"
              ? "bg-brand-50 text-brand-900 ring-brand-200"
              : "bg-white ring-stone-200 dark:bg-stone-900"
          }`}
          onClick={() => setMobilePaneAndUrl("riders")}
        >
          <Users size={16} aria-hidden /> Riders ({trackingRiders.length})
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {liveMsg && (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-900 dark:bg-brand-950/50">
          {liveMsg}
        </p>
      )}

      {bulkMsg && (
        <p className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-800">
          {bulkMsg}
        </p>
      )}

      {showSkeleton && <div className="skeleton min-h-[320px] flex-1 rounded-2xl" />}

      {!showSkeleton && data && (
        <div className={`flex min-h-0 flex-1 flex-col gap-3 ${tvMode ? "" : "lg:flex-row"}`}>
          <div
            className={`min-h-0 min-w-0 flex-1 ${!tvMode && mobilePane === "riders" ? "hidden lg:block" : ""}`}
          >
            <OrderBoard
              columns={columns}
              cancelledToday={tvMode ? [] : cancelled}
              timeZone={tz}
              serverTime={data.board.serverTime}
              role={user?.role}
              flashIds={flashIds}
              tvMode={tvMode}
              onOpen={(row) => setDrawerId(row.id)}
              onAction={runAction}
              onAssignRider={canAssignRider ? (row) => setRiderPickRow(row) : undefined}
              onLongPress={canAssignRider ? toggleSelect : undefined}
              onMoveCard={canMoveCard ? runMoveCard : undefined}
              onOpenDuplicate={(id) => setDrawerId(id)}
              selectedIds={selected}
            />
          </div>
          {!tvMode && (
          <aside
            className={`w-full shrink-0 lg:w-72 ${mobilePane === "board" ? "hidden lg:block" : ""}`}
          >
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">Riders</h2>
            <div className="max-h-[min(70vh,720px)] overflow-y-auto">
              <RiderPanel
                riders={trackingRiders}
                canAssign={canAssignRider}
                onOpenOrder={(id) => setDrawerId(id)}
                onAssignDelivery={(id) => setAssignTargetRiderId(id)}
                onSelectRider={(id) => setQuery({ riderId: id })}
              />
            </div>
          </aside>
          )}
        </div>
      )}

      {boardUndo && (
        <KitchenUndoToast
          message={`${boardUndo.label} moved`}
          expiresAt={boardUndo.expiresAt}
          onUndo={() => void undoBoardMove()}
          onDone={() => setBoardUndo(null)}
        />
      )}

      <TrackingBulkBar
        count={selectedDeliveryIds.length}
        busy={bulkBusy}
        onAssignRider={() => setBulkRiderOpen(true)}
        onClear={() => setSelected(new Set())}
      />

      {drawerId && (
        <OrdersDetailDrawer
          orderId={drawerId}
          timeZone={tz}
          role={user?.role}
          riders={pickerRiders}
          onClose={() => setDrawerId(null)}
          onAction={async (detail, action) => {
            await transitionAdminOrder(detail.id, { targetStatus: action.targetStatus });
            refresh();
          }}
          onAssignRider={async (id, rid) => {
            await assignAdminOrderRider(id, rid);
            refresh();
          }}
          onCancel={() => setDrawerId(null)}
        />
      )}

      <RiderPickerSheet
        open={Boolean(riderPickRow)}
        title="Assign rider"
        riders={pickerRiders}
        onClose={() => setRiderPickRow(null)}
        onSelect={(rid) => {
          const row = riderPickRow;
          setRiderPickRow(null);
          if (row) void assignAdminOrderRider(row.id, rid).then(refresh);
        }}
      />

      <RiderPickerSheet
        open={bulkRiderOpen}
        title={`Assign rider to ${selectedDeliveryIds.length} deliveries`}
        riders={pickerRiders}
        onClose={() => setBulkRiderOpen(false)}
        onSelect={(rid) => void runBulkAssign(rid)}
      />

      <UnassignedOrderPickerSheet
        open={Boolean(assignTargetRiderId && assignTargetRider)}
        riderName={assignTargetRider?.name ?? ""}
        orders={unassignedDeliveries}
        onClose={() => setAssignTargetRiderId(null)}
        onSelect={(orderId) => {
          const rid = assignTargetRiderId;
          setAssignTargetRiderId(null);
          if (rid) void assignAdminOrderRider(orderId, rid).then(refresh);
        }}
      />
    </div>
  );
}
