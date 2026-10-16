"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bike,
  Download,
  MapPin,
  Phone,
  StickyNote,
  User,
  X,
} from "lucide-react";
import { downloadInvoice } from "@/lib/api";
import { formatWhen, pkr } from "@/lib/format";
import { STATUS_THEME } from "@/lib/admin-status";
import { Order } from "@/lib/types";
import { FulfillmentBadge } from "@/components/FulfillmentBadge";
import { OrderDeviceInfo } from "./OrderDeviceInfo";
import { OrderControlsSummary } from "./OrderControlsSummary";
import { StatusBadge } from "./StatusBadge";

const CLOSE_MS = 340;

export function OrderDetailSheet({
  order,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  const theme = STATUS_THEME[order.status];
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);

  const close = useCallback(() => {
    setClosing(true);
    setVisible(false);
    window.setTimeout(onClose, CLOSE_MS);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";

    const r1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(r1);
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [close]);

  const sheet = (
    <div className="fixed inset-0 z-[100] flex justify-end" aria-hidden={closing}>
      <button
        type="button"
        aria-label="Close order details"
        onClick={close}
        className={`drawer-backdrop absolute inset-0 bg-stone-950/70 backdrop-blur-[5px] ${
          visible && !closing ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Order ${order.orderNumber}`}
        className={`drawer-panel relative flex h-full w-full max-w-[640px] flex-col rounded-l-2xl bg-white shadow-[-12px_0_48px_rgba(0,0,0,0.22)] ${
          visible && !closing ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className={`h-1 shrink-0 rounded-tl-2xl ${theme.stripe}`} />

        <header className="shrink-0 border-b border-stone-200 px-7 pb-5 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-stone-500">Order details</p>
              <h2 className="mt-0.5 text-2xl font-semibold tracking-tight text-stone-900">
                {order.orderNumber}
              </h2>
            </div>
            <button
              type="button"
              onClick={close}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-stone-200 bg-white text-stone-500 shadow-sm transition hover:border-stone-300 hover:text-stone-800"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-4 flex items-start justify-between gap-4 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <FulfillmentBadge type={order.fulfillmentType} size="md" />
                <StatusBadge status={order.status} fulfillmentType={order.fulfillmentType} size="md" />
                <span className="text-xs text-stone-500">{formatWhen(order.createdAt)}</span>
              </div>
              <p className="mt-2 text-sm text-stone-600">
                {itemCount} item{itemCount === 1 ? "" : "s"} · {order.customerName}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] font-medium text-stone-500">Total</p>
              <p className="text-2xl font-bold text-stone-900">{pkr(order.total)}</p>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-5">
          <section>
            <h3 className="mb-3 text-sm font-semibold text-stone-800">Customer</h3>
            <dl className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-stone-50/50">
              <div className="flex gap-3 px-4 py-3">
                <User size={16} className="mt-0.5 shrink-0 text-stone-400" />
                <div className="min-w-0">
                  <dt className="text-[11px] font-medium text-stone-400">Name</dt>
                  <dd className="mt-0.5 text-sm font-medium text-stone-900">{order.customerName}</dd>
                </div>
              </div>
              <div className="flex gap-3 px-4 py-3">
                <Phone size={16} className="mt-0.5 shrink-0 text-stone-400" />
                <div className="min-w-0">
                  <dt className="text-[11px] font-medium text-stone-400">Phone</dt>
                  <dd className="mt-0.5">
                    <a
                      href={`tel:${order.customerPhone}`}
                      className="text-sm font-semibold text-brand-700 hover:underline"
                    >
                      {order.customerPhone}
                    </a>
                  </dd>
                </div>
              </div>
              <div className="flex gap-3 px-4 py-3">
                <MapPin size={16} className="mt-0.5 shrink-0 text-stone-400" />
                <div className="min-w-0">
                  <dt className="text-[11px] font-medium text-stone-400">
                    {order.fulfillmentType === "PICKUP" ? "Takeaway" : "Delivery address"}
                  </dt>
                  <dd className="mt-0.5 text-sm leading-relaxed text-stone-700">{order.deliveryAddress}</dd>
                </div>
              </div>
            </dl>
          </section>

          <OrderDeviceInfo order={order} />
          <OrderControlsSummary order={order} />

          <section className="mt-6">
            <h3 className="mb-3 text-sm font-semibold text-stone-800">Items</h3>
            <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
              {order.items.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between gap-4 px-4 py-3.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-stone-100 text-xs font-bold text-stone-700">
                      {i.quantity}×
                    </span>
                    <span className="text-sm font-medium text-stone-900">{i.nameAtOrder}</span>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-stone-700">
                    {pkr(Number(i.priceAtOrder) * i.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {order.notes && (
            <section className="mt-4">
              <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                <StickyNote size={16} className="mt-0.5 shrink-0 text-amber-600" />
                <div>
                  <p className="text-xs font-semibold text-amber-800">Customer note</p>
                  <p className="mt-0.5 text-sm text-amber-900">{order.notes}</p>
                </div>
              </div>
            </section>
          )}

          {order.rider && (
            <section className="mt-4">
              <div className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-medium text-stone-800">
                <Bike size={15} className="text-stone-500" />
                {order.rider.name}
                {order.rider.phone && <span className="text-stone-500">· {order.rider.phone}</span>}
              </div>
            </section>
          )}
        </div>

        {(order.status === "DELIVERED" || order.invoice) && (
          <footer className="shrink-0 border-t border-stone-200 bg-white px-7 py-4">
            <button
              type="button"
              onClick={() => downloadInvoice(order.id)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white py-2.5 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700"
            >
              <Download size={16} /> Invoice
            </button>
          </footer>
        )}
      </aside>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(sheet, document.body);
}
