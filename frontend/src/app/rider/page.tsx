"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, MapPin, Navigation, Phone, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { pkr } from "@/lib/format";
import { Order, orderStatusLabel } from "@/lib/types";
import { FulfillmentBadge } from "@/components/FulfillmentBadge";
import { useLiveOrders } from "@/hooks/useLiveOrders";

export default function RiderDeliveriesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState("");
  const [cashPending, setCashPending] = useState<{ todayPending: number; totalPending: number; pendingCount: number } | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [orders, cash] = await Promise.all([
        api<Order[]>("/rider/orders"),
        api<{ todayPending: number; totalPending: number; pendingCount: number }>("/rider/cash/pending").catch(() => null),
      ]);
      setOrders(orders);
      setCashPending(cash);
    } catch {
      setOrders([]);
      setCashPending(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const silentLoad = useCallback(() => {
    load(true);
  }, [load]);
  useLiveOrders(silentLoad);

  useEffect(() => {
    load();
    const id = window.setInterval(() => load(true), 15000);
    return () => window.clearInterval(id);
  }, [load]);

  async function act(id: string, action: "PICKED_UP" | "DELIVERED") {
    setActionError("");
    try {
      await api(`/rider/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ action }) });
      await load(true);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not update delivery status.");
    }
  }

  const active = orders.filter((o) => o.status !== "DELIVERED");
  const done = orders.filter((o) => o.status === "DELIVERED");

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-stone-900">Deliveries</h1>
          <p className="mt-0.5 text-sm text-stone-500">
            {active.length} active · {done.length} completed
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={refreshing}
          className="inline-flex h-10 items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-600"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {cashPending && cashPending.pendingCount > 0 && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You are holding {pkr(cashPending.totalPending)} COD ({cashPending.pendingCount} orders). Hand cash to the cashier when you return.
          {cashPending.todayPending > 0 ? ` Today: ${pkr(cashPending.todayPending)}.` : ""}
        </p>
      )}

      {actionError && (
        <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</p>
      )}

      {loading || refreshing ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="skeleton h-48 rounded-2xl" />
          ))}
        </div>
      ) : active.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-white px-5 py-14 text-center">
          <p className="font-display text-xl text-stone-800">No active drops</p>
          <p className="mt-2 text-sm text-stone-500">
            When the kitchen assigns you a bag, it will show up here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {active.map((o) => (
            <article key={o.id} className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
              <div className="border-b border-stone-100 bg-violet-50/50 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-violet-700">{o.orderNumber}</p>
                    <FulfillmentBadge type={o.fulfillmentType} />
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200">
                    {orderStatusLabel(o.status, o.fulfillmentType)}
                  </span>
                </div>
                <p className="mt-1 font-display text-2xl text-stone-900">{pkr(o.total)}</p>
              </div>

              <div className="space-y-3 p-4">
                <div className="rounded-xl bg-stone-50 p-3">
                  <p className="flex items-start gap-2 text-sm font-medium text-stone-800">
                    <MapPin size={16} className="mt-0.5 shrink-0 text-violet-600" />
                    {o.deliveryAddress}
                  </p>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(o.deliveryAddress)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700"
                  >
                    <Navigation size={14} /> Open in Maps
                  </a>
                </div>

                <a
                  href={`tel:${o.customerPhone}`}
                  className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3.5 text-sm font-semibold text-stone-800 active:bg-stone-50"
                >
                  <span className="flex items-center gap-2">
                    <Phone size={16} className="text-brand-600" />
                    {o.customerName}
                  </span>
                  <span className="text-brand-700">{o.customerPhone}</span>
                </a>

                <ul className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-600">
                  {o.items.map((i) => (
                    <li key={i.id} className="py-1">
                      {i.quantity}× {i.nameAtOrder}
                    </li>
                  ))}
                </ul>

                <div className="grid gap-2 pt-1">
                  {o.status !== "OUT_FOR_DELIVERY" && (
                    <button
                      type="button"
                      className="btn-ghost h-14 w-full text-base"
                      onClick={() => act(o.id, "PICKED_UP")}
                    >
                      Mark picked up
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-primary h-14 w-full text-base"
                    onClick={() => act(o.id, "DELIVERED")}
                  >
                    <Check size={18} /> Mark delivered
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div className="pt-2">
          <h2 className="text-sm font-semibold text-stone-500">Recently completed</h2>
          <ul className="mt-2 space-y-2">
            {done.slice(0, 8).map((o) => (
              <li key={o.id} className="flex items-center justify-between rounded-xl border border-stone-100 bg-white px-4 py-3 text-sm">
                <span className="flex items-center gap-2 font-medium">
                  {o.orderNumber}
                  <FulfillmentBadge type={o.fulfillmentType} />
                </span>
                <span className="text-emerald-600">{pkr(o.total)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
