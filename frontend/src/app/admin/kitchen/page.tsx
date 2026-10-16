"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BellOff, ChefHat, Printer, Timer, Volume2 } from "lucide-react";
import { api } from "@/lib/api";
import { fetchOrderBoard } from "@/lib/admin-orders";
import { Order, OrderStatus } from "@/lib/types";
import { usePoll } from "@/hooks/usePoll";
import { useLiveOrders } from "@/hooks/useLiveOrders";
import { STATUS_THEME } from "@/lib/admin-status";
import { KitchenTicket } from "@/components/admin/KitchenTicket";
import { RefreshButton } from "@/components/admin/RefreshButton";
import {
  playKitchenChime,
  readKitchenAlertsEnabled,
  unlockKitchenAudio,
  writeKitchenAlertsEnabled,
} from "@/lib/kitchen-chime";
import { useStore } from "@/lib/store";
import { printKotForOrder } from "@/lib/print-kot";

type Lane = "CONFIRMED" | "PREPARING" | "READY";
type TypeFilter = "ALL" | "DELIVERY" | "PICKUP" | "DINE_IN";

const LANES: { status: Lane; title: string; hint: string }[] = [
  { status: "CONFIRMED", title: "New", hint: "Start cooking" },
  { status: "PREPARING", title: "Cooking", hint: "Mark ready" },
  { status: "READY", title: "Ready", hint: "Waiting for rider or counter" },
];

export default function KitchenPage() {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [soundOn, setSoundOn] = useState(false);
  const [soundReady, setSoundReady] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [printBusyId, setPrintBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const seenRef = useRef<Set<string> | null>(null);
  const printedRef = useRef<Set<string>>(new Set());
  const store = useStore();
  const autoPrintKot = Boolean(store?.settings.autoPrintKitchenTickets);

  const load = useCallback(
    () =>
      fetchOrderBoard(["CONFIRMED", "PREPARING", "READY"] as OrderStatus[]).then((res) => res.orders),
    []
  );
  const { data, loading, refreshing, error, refresh } = usePoll(load, 5000);
  useLiveOrders(refresh);
  const showSkeleton = loading && !data;

  useEffect(() => {
    const saved = readKitchenAlertsEnabled();
    setSoundOn(saved);
    if (saved) void unlockKitchenAudio().then(setSoundReady);
  }, []);

  const kitchenOrders = useMemo(() => {
    const list = (data || []).filter(
      (o) => o.status === "CONFIRMED" || o.status === "PREPARING" || o.status === "READY"
    );
    if (typeFilter === "ALL") return list;
    return list.filter((o) => (o.fulfillmentType || "DELIVERY") === typeFilter);
  }, [data, typeFilter]);

  useEffect(() => {
    const newIds = kitchenOrders.filter((o) => o.status === "CONFIRMED").map((o) => o.id);
    if (!seenRef.current) {
      seenRef.current = new Set(newIds);
      return;
    }
    const fresh = newIds.filter((id) => !seenRef.current!.has(id));
    if (fresh.length && soundOn) void playKitchenChime();
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
  }, [kitchenOrders, soundOn, autoPrintKot]);

  async function printKot(orderId: string) {
    setPrintBusyId(orderId);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
    try {
      await printKotForOrder(orderId);
    } catch (e) {
      setErrors((prev) => ({
        ...prev,
        [orderId]: e instanceof Error ? e.message : "Could not print KOT.",
      }));
    } finally {
      setPrintBusyId(null);
    }
  }

  async function toggleAlerts() {
    if (soundOn && soundReady) {
      setSoundOn(false);
      setSoundReady(false);
      writeKitchenAlertsEnabled(false);
      return;
    }
    if (soundOn && !soundReady) {
      const ok = await unlockKitchenAudio();
      setSoundReady(ok);
      await playKitchenChime(true);
      return;
    }
    setSoundOn(true);
    writeKitchenAlertsEnabled(true);
    const ok = await unlockKitchenAudio();
    setSoundReady(ok);
    await playKitchenChime(true);
  }

  async function bump(order: Order, status: OrderStatus) {
    setBusyId(order.id);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[order.id];
      return next;
    });
    try {
      await api(`/orders/${order.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      await refresh();
    } catch (e) {
      setErrors((prev) => ({
        ...prev,
        [order.id]: e instanceof Error ? e.message : "Could not update ticket",
      }));
    } finally {
      setBusyId(null);
    }
  }

  function actionFor(order: Order) {
    if (order.status === "CONFIRMED") {
      return { label: "Start cooking", run: () => bump(order, "PREPARING") };
    }
    if (order.status === "PREPARING") {
      return { label: "Mark ready", run: () => bump(order, "READY") };
    }
    if (order.status === "READY") {
      if (order.fulfillmentType === "DINE_IN") {
        return { label: "Served", run: () => bump(order, "SERVED") };
      }
      if (order.fulfillmentType === "PICKUP") {
        return { label: "Collected", run: () => bump(order, "COLLECTED") };
      }
      return { label: "Hand to rider", run: () => bump(order, "OUT_FOR_DELIVERY") };
    }
    return null;
  }

  const counts = {
    CONFIRMED: kitchenOrders.filter((o) => o.status === "CONFIRMED").length,
    PREPARING: kitchenOrders.filter((o) => o.status === "PREPARING").length,
    READY: kitchenOrders.filter((o) => o.status === "READY").length,
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="shrink-0 rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
              <ChefHat size={20} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-stone-900 sm:text-2xl">Kitchen</h1>
              <p className="mt-0.5 text-sm text-stone-500">Tickets for the pass · auto-refresh every 5s</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 lg:gap-3">
            {[
              { label: "New", value: counts.CONFIRMED, accent: "text-amber-700 bg-amber-50 ring-amber-100" },
              { label: "Cooking", value: counts.PREPARING, accent: "text-blue-700 bg-blue-50 ring-blue-100" },
              { label: "Ready", value: counts.READY, accent: "text-violet-700 bg-violet-50 ring-violet-100" },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl px-3 py-2 ring-1 ${s.accent}`}>
                <p className="text-[11px] font-medium text-stone-500">{s.label}</p>
                <p className="mt-0.5 text-lg font-semibold leading-none">{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-stone-500">
              <Timer size={13} className="text-emerald-500" />
              Live
            </span>
            {LANES.map((lane) => {
              const theme = STATUS_THEME[lane.status];
              const count = kitchenOrders.filter((o) => o.status === lane.status).length;
              return (
                <span
                  key={lane.status}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ${theme.bg} ${theme.text} ${theme.ring}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${theme.dot}`} />
                  {lane.title}
                  <span className="font-semibold">{count}</span>
                </span>
              );
            })}
            <div className="ml-1 inline-flex rounded-lg bg-stone-100 p-0.5">
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
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                    typeFilter === id ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void toggleAlerts()}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ring-1 ${
                soundOn
                  ? soundReady
                    ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                    : "bg-amber-50 text-amber-900 ring-amber-200"
                  : "bg-white text-stone-600 ring-stone-200"
              }`}
              title={soundOn && !soundReady ? "Click again if you did not hear the test beep" : undefined}
            >
              {soundOn ? <Volume2 size={14} /> : <BellOff size={14} />}
              {soundOn ? (soundReady ? "Alerts on" : "Tap to enable sound") : "Alerts off"}
            </button>
            <Link
              href="/admin/kitchen/stations"
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600"
            >
              <Printer size={14} /> Stations
            </Link>
            <RefreshButton busy={loading || refreshing} onClick={refresh} variant="primary" />
          </div>
        </div>
      </div>

      {error && (
        <div className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
        {LANES.map((lane) => {
          const theme = STATUS_THEME[lane.status];
          const list = kitchenOrders.filter((o) => o.status === lane.status);
          return (
            <div key={lane.status} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <div className={`shrink-0 rounded-t-2xl border border-b-0 px-4 py-3 ${theme.border} ${theme.bg}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${theme.dot}`} />
                    <h2 className="truncate text-sm font-semibold text-stone-800">{lane.title}</h2>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${theme.bg} ${theme.text} ${theme.ring}`}
                  >
                    {list.length}
                  </span>
                </div>
                <p className="mt-1 text-xs text-stone-500">{lane.hint}</p>
              </div>

              <div className="kanban-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain rounded-b-2xl border border-t-0 border-stone-200/80 bg-white p-2 pr-1 shadow-inner">
                <div className="flex flex-col gap-2.5">
                {showSkeleton ? (
                  <>
                    <div className="skeleton h-32 rounded-xl" />
                    <div className="skeleton h-28 rounded-xl" />
                  </>
                ) : list.length === 0 ? (
                  <div className="flex min-h-[140px] flex-col items-center justify-center rounded-xl border border-dashed border-stone-200 bg-stone-50/80 px-4 py-10 text-center">
                    <div className={`mb-3 grid h-10 w-10 place-items-center rounded-full ${theme.bg}`}>
                      <span className={`h-2.5 w-2.5 rounded-full ${theme.dot}`} />
                    </div>
                    <p className="text-sm font-medium text-stone-500">No tickets</p>
                    <p className="mt-1 text-xs text-stone-400">{lane.hint}</p>
                  </div>
                ) : (
                list.map((order) => {
                  const action = actionFor(order);
                  return (
                    <KitchenTicket
                      key={order.id}
                      order={order}
                      actionLabel={action?.label}
                      onAction={action?.run}
                      onPrint={() => void printKot(order.id)}
                      printBusy={printBusyId === order.id}
                      busy={busyId === order.id}
                      error={errors[order.id]}
                    />
                  );
                })
                )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
