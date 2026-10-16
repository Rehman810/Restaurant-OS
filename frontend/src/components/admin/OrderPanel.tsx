"use client";

import { Bike, Download, MapPin, Phone, StickyNote, User } from "lucide-react";
import { downloadInvoice } from "@/lib/api";
import { formatWhen, pkr } from "@/lib/format";
import { Rider } from "@/lib/admin-types";
import { STATUS_THEME } from "@/lib/admin-status";
import { isBackwardMove, Order, OrderStatus, STATUS_FLOW, STATUS_LABEL, orderStatusLabel } from "@/lib/types";
import { FulfillmentBadge } from "@/components/FulfillmentBadge";
import { OrderDeviceInfo } from "./OrderDeviceInfo";
import { OrderControlsSummary } from "./OrderControlsSummary";
import { StatusBadge } from "./StatusBadge";
import { AdminSelect } from "./AdminSelect";

export function OrderPanel({
  order,
  riders,
  onStatus,
  onAssign,
  onConfirm,
  onSelect,
  compact,
  forwardOnly,
}: {
  order: Order;
  riders: Rider[];
  onStatus: (id: string, status: OrderStatus) => void;
  onAssign: (id: string, riderId: string) => void;
  onConfirm?: (id: string) => void;
  onSelect?: () => void;
  compact?: boolean;
  forwardOnly?: boolean;
}) {
  const showRider =
    order.fulfillmentType !== "PICKUP" &&
    order.status !== "DELIVERED" &&
    order.status !== "CANCELLED" &&
    order.status !== "PENDING_CONFIRMATION";
  const theme = STATUS_THEME[order.status];
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);
  const statusOptions = (forwardOnly ? STATUS_FLOW : (Object.keys(STATUS_LABEL) as OrderStatus[])).map((k) => ({
    value: k,
    label: orderStatusLabel(k, order.fulfillmentType),
    status: k,
    disabled: forwardOnly ? isBackwardMove(order.status, k) : false,
  }));

  return (
    <article
      className={`group relative overflow-visible rounded-2xl border bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg ${theme.border} ${theme.ring} ring-1 ${onSelect ? "cursor-pointer" : ""}`}
      onClick={onSelect}
      onKeyDown={onSelect ? (e) => e.key === "Enter" && onSelect() : undefined}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
    >
      <div className={`h-1 rounded-t-2xl ${theme.stripe}`} />

      <div className={compact ? "p-4" : "p-5"}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-lg font-bold text-stone-900">{order.orderNumber}</p>
              <FulfillmentBadge type={order.fulfillmentType} size="md" />
              <StatusBadge status={order.status} fulfillmentType={order.fulfillmentType} size="md" />
            </div>
            <p className="mt-1 text-xs text-stone-400">{formatWhen(order.createdAt)} · {itemCount} items</p>
          </div>
          <div className="shrink-0 rounded-xl bg-gradient-to-br from-brand-50 to-orange-50 px-3 py-2 text-right ring-1 ring-brand-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600">Total</p>
            <p className="font-display text-xl font-bold text-brand-700">{pkr(order.total)}</p>
          </div>
        </div>

        {/* Customer block */}
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="flex items-center gap-2.5 rounded-xl bg-stone-50 px-3 py-2.5 ring-1 ring-stone-100">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-stone-400 shadow-sm">
              <User size={14} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Customer</p>
              <p className="truncate text-sm font-semibold text-stone-800">{order.customerName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl bg-stone-50 px-3 py-2.5 ring-1 ring-stone-100">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-stone-400 shadow-sm">
              <Phone size={14} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Phone</p>
              <a href={`tel:${order.customerPhone}`} className="truncate text-sm font-semibold text-stone-800 hover:text-brand-700">
                {order.customerPhone}
              </a>
            </div>
          </div>
          <div className="flex items-start gap-2.5 rounded-xl bg-stone-50 px-3 py-2.5 ring-1 ring-stone-100 sm:col-span-3 lg:col-span-1">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-stone-400 shadow-sm">
              <MapPin size={14} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Address</p>
              <p className="line-clamp-2 text-sm font-medium text-stone-700">{order.deliveryAddress}</p>
            </div>
          </div>
        </div>

        {!compact && <OrderDeviceInfo order={order} />}
        {!compact && <OrderControlsSummary order={order} />}

        {/* Items */}
        {!compact && (
          <ul className="mt-4 divide-y divide-stone-100 rounded-xl border border-stone-100 bg-stone-50/50">
            {order.items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white text-xs font-bold text-brand-700 ring-1 ring-brand-100">
                    {i.quantity}
                  </span>
                  <span className="truncate text-sm font-medium text-stone-800">{i.nameAtOrder}</span>
                </div>
                <span className="shrink-0 text-sm font-semibold text-stone-600">
                  {pkr(Number(i.priceAtOrder) * i.quantity)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {order.notes && (
          <div className="mt-3 flex gap-2.5 rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-2.5">
            <StickyNote size={15} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Note</p>
              <p className="text-sm text-amber-900">{order.notes}</p>
            </div>
          </div>
        )}

        {order.rider && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800 ring-1 ring-violet-200">
            <Bike size={14} className="text-violet-600" />
            {order.rider.name}
            {order.rider.phone && <span className="text-violet-600">· {order.rider.phone}</span>}
          </div>
        )}

        {order.status === "PENDING_CONFIRMATION" && onConfirm && (
          <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
            <p className="text-sm font-semibold text-orange-950">Call customer to verify this order</p>
            <p className="mt-1 text-xs text-orange-800">
              {order.customerPhone}
              {order.customerEmail ? ` · ${order.customerEmail}` : ""}
            </p>
            <button
              type="button"
              onClick={() => onConfirm(order.id)}
              className="btn-primary mt-3 h-10 w-full text-sm"
            >
              Confirm order → send to kitchen
            </button>
          </div>
        )}

        {/* Actions */}
        <div
          className="mt-5 flex flex-wrap items-end gap-3 rounded-xl bg-stone-50/80 p-3 ring-1 ring-stone-100"
          onClick={(e) => e.stopPropagation()}
        >
          <AdminSelect
            value={order.status}
            label="Status"
            aria-label="Order status"
            minWidth="min-w-[170px]"
            options={statusOptions}
            onChange={(v) => onStatus(order.id, v as OrderStatus)}
          />

          {showRider && (
            <AdminSelect
              value={order.riderId || ""}
              label="Rider"
              aria-label="Assign rider"
              minWidth="min-w-[150px]"
              placeholder="Assign rider"
              options={riders.map((r) => ({ value: r.id, label: r.name }))}
              onChange={(v) => v && onAssign(order.id, v)}
            />
          )}

          {(order.status === "DELIVERED" || order.invoice) && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-bold text-stone-700 shadow-sm transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
              onClick={() => downloadInvoice(order.id)}
            >
              <Download size={14} /> Invoice
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
