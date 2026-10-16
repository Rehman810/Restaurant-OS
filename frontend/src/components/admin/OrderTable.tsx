"use client";

import { Bike, ClipboardList, Download, Phone } from "lucide-react";
import { AdminEmptyState } from "@/components/admin/ui";
import { downloadInvoice } from "@/lib/api";
import { formatWhen, pkr } from "@/lib/format";
import { Rider } from "@/lib/admin-types";
import { forwardStatusOptions, Order, OrderStatus, STATUS_LABEL } from "@/lib/types";
import { FulfillmentBadge } from "@/components/FulfillmentBadge";
import { AdminSelect } from "./AdminSelect";

function statusOptionsFor(order: Order) {
  const allowed = new Set(forwardStatusOptions(order.status));
  return Object.entries(STATUS_LABEL)
    .filter(([k]) => allowed.has(k as OrderStatus))
    .map(([k, v]) => ({ value: k, label: v, status: k as OrderStatus }));
}

function itemSummary(order: Order) {
  return order.items.map((i) => `${i.quantity}× ${i.nameAtOrder}`).join(", ");
}

export function OrderTable({
  orders,
  riders,
  onStatus,
  onAssign,
  onConfirm,
  onSelect,
}: {
  orders: Order[];
  riders: Rider[];
  onStatus: (id: string, status: OrderStatus) => void;
  onAssign: (id: string, riderId: string) => void;
  onConfirm?: (id: string) => void;
  onSelect?: (order: Order) => void;
}) {
  if (orders.length === 0) {
    return (
      <AdminEmptyState
        icon={ClipboardList}
        title="No orders to show"
        description="Adjust filters or wait for new orders from the storefront or POS."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-stone-100 bg-stone-50/80 text-[11px] font-bold uppercase tracking-wider text-stone-400">
              <th className="px-4 py-3 font-semibold">Order</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Items</th>
              <th className="px-4 py-3 font-semibold">Address</th>
              <th className="px-4 py-3 font-semibold">Rider</th>
              <th className="px-4 py-3 text-right font-semibold">Total</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const showRider =
                order.fulfillmentType !== "PICKUP" &&
                order.status !== "DELIVERED" &&
                order.status !== "CANCELLED" &&
                order.status !== "PENDING_CONFIRMATION";
              const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);

              return (
                <tr
                  key={order.id}
                  className={`border-b border-stone-100 last:border-0 hover:bg-orange-50/40 ${onSelect ? "cursor-pointer" : ""}`}
                  onClick={() => onSelect?.(order)}
                >
                  <td className="whitespace-nowrap px-4 py-3.5 align-top">
                    <p className="font-display font-bold text-stone-900">{order.orderNumber}</p>
                    <p className="mt-0.5 text-xs text-stone-400">{formatWhen(order.createdAt)}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 align-top">
                    <FulfillmentBadge type={order.fulfillmentType} size="md" />
                  </td>
                  <td className="px-4 py-3.5 align-top">
                    <p className="font-semibold text-stone-800">{order.customerName}</p>
                    <a
                      href={`tel:${order.customerPhone}`}
                      className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-brand-700"
                    >
                      <Phone size={11} />
                      {order.customerPhone}
                    </a>
                  </td>
                  <td className="max-w-[220px] px-4 py-3.5 align-top">
                    <p className="line-clamp-2 text-stone-700">{itemSummary(order)}</p>
                    <p className="mt-0.5 text-xs text-stone-400">{itemCount} items</p>
                  </td>
                  <td className="max-w-[200px] px-4 py-3.5 align-top">
                    <p className="line-clamp-2 text-stone-600">{order.deliveryAddress}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 align-top">
                    {order.rider ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800 ring-1 ring-violet-200">
                        <Bike size={12} />
                        {order.rider.name}
                      </span>
                    ) : (
                      <span className="text-xs text-stone-400">Unassigned</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right align-top">
                    <p className="font-display text-base font-bold text-brand-700">{pkr(order.total)}</p>
                  </td>
                  <td className="px-4 py-3.5 align-top" onClick={(e) => e.stopPropagation()}>
                    <AdminSelect
                      value={order.status}
                      aria-label={`Status for ${order.orderNumber}`}
                      minWidth="min-w-[150px]"
                      options={statusOptionsFor(order)}
                      onChange={(v) => onStatus(order.id, v as OrderStatus)}
                    />
                  </td>
                  <td className="px-4 py-3.5 align-top" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-col gap-2">
                      {order.status === "PENDING_CONFIRMATION" && onConfirm && (
                        <button
                          type="button"
                          onClick={() => onConfirm(order.id)}
                          className="btn-primary h-9 whitespace-nowrap px-3 text-xs"
                        >
                          Confirm
                        </button>
                      )}
                      {showRider && (
                        <AdminSelect
                          value={order.riderId || ""}
                          aria-label={`Assign rider for ${order.orderNumber}`}
                          minWidth="min-w-[140px]"
                          placeholder="Assign rider"
                          options={riders.map((r) => ({ value: r.id, label: r.name }))}
                          onChange={(v) => v && onAssign(order.id, v)}
                        />
                      )}
                      {(order.status === "DELIVERED" || order.invoice) && (
                        <button
                          type="button"
                          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700 shadow-sm transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
                          onClick={() => downloadInvoice(order.id)}
                        >
                          <Download size={13} /> Invoice
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
