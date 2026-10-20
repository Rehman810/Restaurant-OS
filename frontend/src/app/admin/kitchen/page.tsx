"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BellOff,
  ChefHat,
  Maximize2,
  Minimize2,
  Printer,
  Type,
  Volume2,
  WifiOff,
} from "lucide-react";
import { api, SOCKET_URL } from "@/lib/api";
import { fetchOrderBoard } from "@/lib/admin-orders";
import { fetchPrintStations, PrintStation } from "@/lib/admin-print-stations";
import { Order, OrderStatus } from "@/lib/types";
import { usePoll } from "@/hooks/usePoll";
import { useLiveOrders } from "@/hooks/useLiveOrders";
import { STATUS_THEME } from "@/lib/admin-status";
import { KitchenTicket } from "@/components/admin/KitchenTicket";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { KitchenSoundBanner } from "@/components/admin/kitchen/KitchenSoundBanner";
import { KitchenUndoToast } from "@/components/admin/kitchen/KitchenUndoToast";
import {
  playKitchenChime,
  readKitchenAlertsEnabled,
  unlockKitchenAudio,
  writeKitchenAlertsEnabled,
} from "@/lib/kitchen-chime";
import { useStore } from "@/lib/store";
import { printKotForOrder } from "@/lib/print-kot";
import {
  buildAllDayItemCounts,
  defaultPrintStationId,
  filterOrderForStation,
  isKitchenOrderStale,
  orderHasStationItems,
  readyLaneActionLabel,
  readKitchenStationFilter,
  sortKitchenLaneOrders,
  writeKitchenStationFilter,
} from "@/lib/kitchen/helpers";
import { KitchenAllDayStrip } from "@/components/admin/kitchen/KitchenAllDayStrip";
import {
  closeStaleKitchenOrders,
  rejectKitchenOrder,
  setKitchenItemDone,
  setKitchenRush,
  setMenuItemStock,
} from "@/lib/admin-kitchen";
import { useAuth } from "@/lib/auth";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useMediaNarrow } from "@/hooks/useMediaNarrow";
import {
  KITCHEN_TEXT_SCALE,
  KitchenTextSize,
  readKitchenKiosk,
  readKitchenTextSize,
  writeKitchenKiosk,
  writeKitchenTextSize,
} from "@/lib/kitchen/display";
import { AdminThemeToggle } from "@/components/admin/AdminThemeToggle";
import { useAdminTheme } from "@/hooks/useAdminTheme";

const ALLDAY_OPEN_KEY = "uff-kitchen-alday-open";

type Lane = "CONFIRMED" | "PREPARING" | "READY";
type TypeFilter = "ALL" | "DELIVERY" | "PICKUP" | "DINE_IN";

const LANES: { status: Lane; title: string; hint: string }[] = [
  { status: "CONFIRMED", title: "New", hint: "Start cooking" },
  { status: "PREPARING", title: "Cooking", hint: "Mark ready" },
  { status: "READY", title: "Ready", hint: "Hand off to guest, counter, or rider" },
];

const UNDO_MS = 10_000;

type UndoState = {
  orderId: string;
  message: string;
  fromStatus: OrderStatus;
  expiresAt: number;
};

export default function KitchenPage() {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [stationFilter, setStationFilter] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [soundReady, setSoundReady] = useState(false);
  const [liveConnected, setLiveConnected] = useState<boolean | null>(SOCKET_URL ? null : true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [printBusyId, setPrintBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pulsingIds, setPulsingIds] = useState<Set<string>>(() => new Set());
  const [undo, setUndo] = useState<UndoState | null>(null);
  const seenRef = useRef<Set<string> | null>(null);
  const printedRef = useRef<Set<string>>(new Set());
  const store = useStore();
  const { user } = useAuth();
  const autoPrintKot = Boolean(store?.settings.autoPrintKitchenTickets);
  const [allDayOpen, setAllDayOpen] = useState(true);
  const [staleBusy, setStaleBusy] = useState(false);
  const [kiosk, setKiosk] = useState(false);
  const [textSize, setTextSize] = useState<KitchenTextSize>("M");
  const [mobileLane, setMobileLane] = useState<Lane>("CONFIRMED");
  const narrow = useMediaNarrow();
  const { theme, toggle: toggleTheme } = useAdminTheme();
  useWakeLock(true);

  const loadOrders = useCallback(
    () =>
      fetchOrderBoard(["CONFIRMED", "PREPARING", "READY"] as OrderStatus[]).then((res) => res.orders),
    []
  );
  const loadStations = useCallback(() => fetchPrintStations(), []);

  const { data, loading, refreshing, error, refresh } = usePoll(loadOrders, 5000);
  const { data: stationData } = usePoll(loadStations, 60_000);
  const stations = stationData?.stations?.filter((s) => s.isActive) ?? [];

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const onLiveConnect = useCallback((connected: boolean) => {
    setLiveConnected(connected);
    if (connected) void refreshRef.current();
  }, []);

  const onLiveCreated = useCallback(() => {
    if (readKitchenAlertsEnabled()) void playKitchenChime();
  }, []);

  useLiveOrders(refresh, undefined, undefined, {
    onConnectChange: onLiveConnect,
    onCreated: onLiveCreated,
  });

  const showSkeleton = loading && !data;
  const defaultStationId = useMemo(() => defaultPrintStationId(stations), [stations]);

  useEffect(() => {
    setSoundOn(readKitchenAlertsEnabled());
    setStationFilter(readKitchenStationFilter());
    setAllDayOpen(localStorage.getItem(ALLDAY_OPEN_KEY) !== "0");
    setKiosk(readKitchenKiosk());
    setTextSize(readKitchenTextSize());
    const onKiosk = () => setKiosk(readKitchenKiosk());
    window.addEventListener("kitchen-kiosk-change", onKiosk);
    return () => window.removeEventListener("kitchen-kiosk-change", onKiosk);
  }, []);

  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement && kiosk) {
        writeKitchenKiosk(false);
        setKiosk(false);
      }
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, [kiosk]);

  useEffect(() => {
    if (!stations.length || stationFilter) return;
    const saved = readKitchenStationFilter();
    if (saved && stations.some((s) => s.id === saved)) {
      setStationFilter(saved);
    }
  }, [stations, stationFilter]);

  const kitchenOrders = useMemo(() => {
    let list = (data || []).filter(
      (o) => o.status === "CONFIRMED" || o.status === "PREPARING" || o.status === "READY"
    );
    if (typeFilter !== "ALL") {
      list = list.filter((o) => (o.fulfillmentType || "DELIVERY") === typeFilter);
    }
    if (stationFilter) {
      list = list.filter((o) => orderHasStationItems(o, stationFilter, defaultStationId));
    }
    return list;
  }, [data, typeFilter, stationFilter, defaultStationId]);

  const allDayCounts = useMemo(
    () =>
      buildAllDayItemCounts(
        kitchenOrders.map((o) => filterOrderForStation(o, stationFilter, defaultStationId))
      ),
    [kitchenOrders, stationFilter, defaultStationId]
  );

  const staleCount = useMemo(() => kitchenOrders.filter((o) => isKitchenOrderStale(o)).length, [kitchenOrders]);
  const canCloseStale = user?.role === "ADMIN" || user?.role === "MANAGER";
  const isChef = user?.role === "CHEF";
  const textScale = KITCHEN_TEXT_SCALE[textSize];

  const laneCounts = useMemo(
    () => ({
      CONFIRMED: kitchenOrders.filter((o) => o.status === "CONFIRMED").length,
      PREPARING: kitchenOrders.filter((o) => o.status === "PREPARING").length,
      READY: kitchenOrders.filter((o) => o.status === "READY").length,
    }),
    [kitchenOrders]
  );

  const visibleLanes = narrow ? LANES.filter((l) => l.status === mobileLane) : LANES;

  async function toggleKiosk() {
    const next = !kiosk;
    writeKitchenKiosk(next);
    setKiosk(next);
    try {
      if (next) await document.documentElement.requestFullscreen();
      else if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* fullscreen optional */
    }
  }

  function cycleTextSize() {
    const order: KitchenTextSize[] = ["S", "M", "L"];
    const idx = order.indexOf(textSize);
    const next = order[(idx + 1) % order.length];
    setTextSize(next);
    writeKitchenTextSize(next);
  }

  useEffect(() => {
    const newIds = kitchenOrders.filter((o) => o.status === "CONFIRMED").map((o) => o.id);
    if (!seenRef.current) {
      seenRef.current = new Set(newIds);
      return;
    }
    const fresh = newIds.filter((id) => !seenRef.current!.has(id));
    if (fresh.length && soundOn && soundReady) void playKitchenChime();
    if (fresh.length) {
      setPulsingIds((prev) => {
        const next = new Set(prev);
        for (const id of fresh) next.add(id);
        return next;
      });
    }
    if (fresh.length && autoPrintKot) {
      for (const id of fresh) {
        if (printedRef.current.has(id)) continue;
        printedRef.current.add(id);
        void printKotForOrder(id).catch(() => {
          printedRef.current.delete(id);
        });
      }
    }
    seenRef.current = new Set(newIds.concat(kitchenOrders.map((o) => o.id)));
  }, [kitchenOrders, soundOn, soundReady, autoPrintKot]);

  function selectStation(id: string | null) {
    setStationFilter(id);
    writeKitchenStationFilter(id);
  }

  async function enableSound() {
    setSoundOn(true);
    writeKitchenAlertsEnabled(true);
    const ok = await unlockKitchenAudio();
    setSoundReady(ok);
    if (ok) await playKitchenChime(true);
  }

  async function toggleSound() {
    if (soundOn && soundReady) {
      setSoundOn(false);
      setSoundReady(false);
      writeKitchenAlertsEnabled(false);
      return;
    }
    await enableSound();
  }

  function clearPulse(orderId: string) {
    setPulsingIds((prev) => {
      if (!prev.has(orderId)) return prev;
      const next = new Set(prev);
      next.delete(orderId);
      return next;
    });
  }

  async function bump(order: Order, status: OrderStatus, opts?: { kitchenUndo?: boolean; undoMessage?: string }) {
    setBusyId(order.id);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[order.id];
      return next;
    });
    const fromStatus = order.status;
    try {
      await api(`/orders/${order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, kitchenUndo: Boolean(opts?.kitchenUndo) }),
      });
      clearPulse(order.id);
      await refresh();
      if (!opts?.kitchenUndo && opts?.undoMessage) {
        setUndo({
          orderId: order.id,
          message: opts.undoMessage,
          fromStatus,
          expiresAt: Date.now() + UNDO_MS,
        });
      }
    } catch (e) {
      setErrors((prev) => ({
        ...prev,
        [order.id]: e instanceof Error ? e.message : "Could not update ticket",
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function runUndo() {
    if (!undo) return;
    const order = kitchenOrders.find((o) => o.id === undo.orderId) ?? data?.find((o) => o.id === undo.orderId);
    if (!order) {
      setUndo(null);
      return;
    }
    setUndo(null);
    await bump(order, undo.fromStatus, { kitchenUndo: true });
  }

  async function toggleRush(order: Order) {
    setBusyId(order.id);
    try {
      await setKitchenRush(order.id, !order.isRush);
      await refresh();
    } catch (e) {
      setErrors((prev) => ({
        ...prev,
        [order.id]: e instanceof Error ? e.message : "Could not update rush",
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleItemDone(order: Order, itemId: string, done: boolean) {
    setBusyId(order.id);
    try {
      await setKitchenItemDone(order.id, itemId, done);
      await refresh();
    } catch (e) {
      setErrors((prev) => ({
        ...prev,
        [order.id]: e instanceof Error ? e.message : "Could not update item",
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleItemStock(menuItemId: string, isAvailable: boolean) {
    try {
      await setMenuItemStock(menuItemId, isAvailable);
      await refresh();
    } catch (e) {
      setErrors((prev) => ({
        ...prev,
        _stock: e instanceof Error ? e.message : "Could not update menu item",
      }));
    }
  }

  async function rejectOrder(
    order: Order,
    body: {
      scope: "order" | "item";
      reasonCode: import("@/lib/admin-kitchen").KitchenRejectReason;
      reasonNote?: string;
      itemId?: string;
    }
  ) {
    setBusyId(order.id);
    try {
      await rejectKitchenOrder(order.id, body);
      await refresh();
    } catch (e) {
      setErrors((prev) => ({
        ...prev,
        [order.id]: e instanceof Error ? e.message : "Could not reject",
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function bulkCloseStale() {
    if (!confirm(`Cancel ${staleCount} stale ticket(s) older than 2 hours?`)) return;
    setStaleBusy(true);
    try {
      await closeStaleKitchenOrders(2);
      await refresh();
    } catch (e) {
      setErrors((prev) => ({ ...prev, _stale: e instanceof Error ? e.message : "Bulk close failed" }));
    } finally {
      setStaleBusy(false);
    }
  }

  function actionFor(order: Order) {
    if (order.status === "CONFIRMED") {
      return {
        label: "Start cooking",
        run: () => bump(order, "PREPARING", { undoMessage: "Started cooking" }),
      };
    }
    if (order.status === "PREPARING") {
      return {
        label: "Mark ready",
        run: () => bump(order, "READY", { undoMessage: "Marked ready" }),
      };
    }
    if (order.status === "READY") {
      const label = readyLaneActionLabel(order.fulfillmentType);
      const next: OrderStatus =
        order.fulfillmentType === "DINE_IN"
          ? "SERVED"
          : order.fulfillmentType === "PICKUP"
            ? "COLLECTED"
            : "OUT_FOR_DELIVERY";
      return { label, run: () => bump(order, next, { undoMessage: label }) };
    }
    return null;
  }

  const showDisconnectBanner = Boolean(SOCKET_URL) && liveConnected === false;

  function renderLane(lane: (typeof LANES)[number]) {
    const theme = STATUS_THEME[lane.status];
    const list = sortKitchenLaneOrders(
      kitchenOrders.filter((o) => o.status === lane.status),
      lane.status
    );
    return (
      <div key={lane.status} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className={`shrink-0 rounded-t-2xl border border-b-0 px-4 py-2.5 ${theme.border} ${theme.bg}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${theme.dot}`} />
              <h2 className="truncate text-base font-bold text-stone-800 dark:text-stone-100">{lane.title}</h2>
            </div>
            <span
              className={`shrink-0 rounded-full px-3 py-0.5 text-sm font-bold tabular-nums ring-1 ${theme.bg} ${theme.text} ${theme.ring}`}
            >
              {list.length}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{lane.hint}</p>
        </div>

        <div className="kanban-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain rounded-b-2xl border border-t-0 border-stone-200/80 bg-stone-50 p-2 pr-1 shadow-inner dark:border-stone-700 dark:bg-stone-950">
          <div className="flex flex-col gap-2.5">
            {showSkeleton ? (
              <>
                <div className="skeleton h-32 rounded-xl" />
                <div className="skeleton h-28 rounded-xl" />
              </>
            ) : list.length === 0 ? (
              <div className="flex min-h-[140px] flex-col items-center justify-center rounded-xl border border-dashed border-stone-200 bg-white/80 px-4 py-10 text-center dark:border-stone-700 dark:bg-stone-900/50">
                <div className={`mb-3 grid h-10 w-10 place-items-center rounded-full ${theme.bg}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${theme.dot}`} />
                </div>
                <p className="text-sm font-medium text-stone-500 dark:text-stone-400">No tickets</p>
                <p className="mt-1 text-xs text-stone-400">{lane.hint}</p>
              </div>
            ) : (
              list.map((order) => {
                const action = actionFor(order);
                const displayOrder = filterOrderForStation(order, stationFilter, defaultStationId);
                return (
                  <KitchenTicket
                    key={order.id}
                    order={displayOrder}
                    actionLabel={action?.label}
                    onAction={action?.run}
                    onPrint={() => void printKot(order.id)}
                    onToggleRush={() => void toggleRush(order)}
                    onItemDone={(itemId, done) => void toggleItemDone(order, itemId, done)}
                    onItemStock={(menuItemId, available) => void toggleItemStock(menuItemId, available)}
                    onReject={(body) => void rejectOrder(order, body)}
                    printBusy={printBusyId === order.id}
                    busy={busyId === order.id}
                    error={errors[order.id]}
                    pulse={pulsingIds.has(order.id) && order.status === "CONFIRMED"}
                    onAcknowledge={() => clearPulse(order.id)}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="kds-root flex h-full min-h-0 flex-1 flex-col gap-2 overflow-hidden"
      style={{ ["--kds-scale" as string]: textScale }}
    >
      {showDisconnectBanner && (
        <div
          className="flex shrink-0 items-center justify-center gap-2 bg-red-600 px-4 py-3 text-center text-base font-bold text-white"
          role="alert"
        >
          <WifiOff size={20} />
          Disconnected — orders are not updating
        </div>
      )}

      {soundOn && !soundReady && <KitchenSoundBanner onEnable={() => void enableSound()} />}

      <KitchenAllDayStrip
        items={allDayCounts}
        open={allDayOpen}
        onToggle={() => {
          setAllDayOpen((v) => {
            const next = !v;
            localStorage.setItem(ALLDAY_OPEN_KEY, next ? "1" : "0");
            return next;
          });
        }}
      />

      {canCloseStale && staleCount > 0 ? (
        <button
          type="button"
          disabled={staleBusy}
          onClick={() => void bulkCloseStale()}
          className="shrink-0 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-left text-sm font-semibold text-violet-900 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100"
        >
          {staleBusy ? "Closing stale tickets…" : `Close ${staleCount} stale ticket(s) (manager)`}
        </button>
      ) : null}

      <div className="shrink-0 flex flex-col gap-2 rounded-xl border border-stone-200/80 bg-white px-3 py-2 shadow-sm dark:border-stone-700 dark:bg-stone-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <ChefHat size={18} className="shrink-0 text-brand-600 dark:text-brand-400" />
            <h1 className="text-base font-semibold text-stone-900 dark:text-stone-50">Kitchen</h1>
            <span className="hidden text-xs text-stone-400 sm:inline">· Live</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg bg-stone-100 p-0.5 dark:bg-stone-800">
              {(
                [
                  ["ALL", "All"],
                  ["DELIVERY", "Delivery"],
                  ["PICKUP", "Takeaway"],
                  ["DINE_IN", "Dine-in"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTypeFilter(id)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                    typeFilter === id
                      ? "bg-white text-stone-900 shadow-sm dark:bg-stone-700 dark:text-stone-50"
                      : "text-stone-500 dark:text-stone-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void toggleSound()}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold ring-1 ${
                soundOn && soundReady
                  ? "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-800"
                  : soundOn
                    ? "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-800"
                    : "bg-white text-stone-600 ring-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-600"
              }`}
            >
              {soundOn ? <Volume2 size={16} /> : <BellOff size={16} />}
              {soundOn ? (soundReady ? "Sound on" : "Sound") : "Sound off"}
            </button>
            {!isChef ? (
              <Link
                href="/admin/kitchen/stations"
                className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-semibold text-stone-600 dark:border-stone-600 dark:text-stone-300"
              >
                <Printer size={14} /> Stations
              </Link>
            ) : null}
            <button
              type="button"
              onClick={cycleTextSize}
              className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-bold text-stone-700 dark:border-stone-600 dark:text-stone-200"
              title="Text size"
            >
              <Type size={14} /> {textSize}
            </button>
            {kiosk ? <AdminThemeToggle theme={theme} onToggle={toggleTheme} className="!h-9" /> : null}
            <button
              type="button"
              onClick={() => void toggleKiosk()}
              className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-bold text-stone-700 dark:border-stone-600 dark:text-stone-200"
            >
              {kiosk ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              {kiosk ? "Exit kiosk" : "Kiosk"}
            </button>
            <RefreshButton busy={loading || refreshing} onClick={refresh} variant="ghost" className="!px-2.5 !py-1.5 !text-xs" />
          </div>
        </div>

        {stations.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => selectStation(null)}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm font-bold ${
                !stationFilter
                  ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
                  : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300"
              }`}
            >
              All stations
            </button>
            {stations.map((s: PrintStation) => (
              <button
                key={s.id}
                type="button"
                onClick={() => selectStation(s.id)}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm font-bold ${
                  stationFilter === s.id
                    ? "bg-brand-600 text-white"
                    : "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {(error || errors._stock || errors._stale) && (
        <div className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error || errors._stock || errors._stale}
        </div>
      )}

      {narrow ? (
        <div className="flex shrink-0 gap-1 rounded-xl bg-stone-100 p-1 dark:bg-stone-800 md:hidden">
          {LANES.map((lane) => {
            const theme = STATUS_THEME[lane.status];
            const active = mobileLane === lane.status;
            return (
              <button
                key={lane.status}
                type="button"
                onClick={() => setMobileLane(lane.status)}
                className={`flex flex-1 flex-col items-center rounded-lg px-2 py-2 text-xs font-bold ${
                  active
                    ? `bg-white shadow-sm dark:bg-stone-700 ${theme.text}`
                    : "text-stone-500 dark:text-stone-400"
                }`}
              >
                <span>{lane.title}</span>
                <span className="mt-0.5 tabular-nums text-sm">{laneCounts[lane.status]}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">{visibleLanes.map(renderLane)}</div>

      {undo && (
        <KitchenUndoToast
          message={undo.message}
          expiresAt={undo.expiresAt}
          onUndo={() => void runUndo()}
          onDone={() => setUndo(null)}
        />
      )}
    </div>
  );
}
