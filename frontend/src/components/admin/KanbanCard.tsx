"use client";

import { useRef } from "react";
import { ArrowRight, Bike, ChevronRight, GripVertical, MapPin, Package } from "lucide-react";
import { formatElapsed, formatWhen, pkr } from "@/lib/format";
import { STATUS_THEME } from "@/lib/admin-status";
import { FulfillmentBadge } from "@/components/FulfillmentBadge";
import { isOrderTerminal, nextOrderStatus, Order, OrderStatus, orderStatusLabel } from "@/lib/types";

export function KanbanCard({
  order,
  dragging,
  moving,
  onSelect,
  onAdvance,
  onDragStart,
  onDragEnd,
}: {
  order: Order;
  dragging: boolean;
  moving: boolean;
  onSelect: () => void;
  onAdvance: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const didDrag = useRef(false);
  const theme = STATUS_THEME[order.status];
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);
  const nextStatus = nextOrderStatus(order.status, order.fulfillmentType);
  const canAdvance = Boolean(nextStatus) && !isOrderTerminal(order.status);

  return (
    <article
      draggable={!moving}
      onDragStart={(e) => {
        didDrag.current = true;
        e.dataTransfer.setData("text/plain", order.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={() => {
        onDragEnd();
        setTimeout(() => {
          didDrag.current = false;
        }, 0);
      }}
      onClick={() => {
        if (!didDrag.current) onSelect();
      }}
      className={`group relative shrink-0 cursor-grab overflow-hidden rounded-xl border bg-white shadow-sm transition active:cursor-grabbing ${
        dragging ? "scale-[0.98] opacity-40" : "hover:shadow-md"
      } ${theme.border} ${moving ? "pointer-events-none opacity-60" : ""}`}
    >
      <div className={`absolute left-0 top-0 h-full w-1 ${theme.stripe}`} />

      <div className="p-3 pl-4">
        <div className="flex items-start gap-2">
          <GripVertical
            size={14}
            className="mt-1 shrink-0 text-stone-300 transition group-hover:text-stone-400"
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-stone-900">{order.orderNumber}</p>
                <div className="mt-1">
                  <FulfillmentBadge type={order.fulfillmentType} />
                </div>
                <p className="mt-0.5 text-[11px] text-stone-400">{formatWhen(order.createdAt)}</p>
              </div>
              <p className="shrink-0 rounded-lg bg-brand-50 px-2 py-1 text-sm font-semibold text-brand-700 ring-1 ring-brand-100">
                {pkr(order.total)}
              </p>
            </div>

            <p className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
              <span className={`h-1.5 w-1.5 rounded-full ${theme.dot}`} />
              {formatElapsed(order.createdAt)}
            </p>

            <div className="mt-2.5 flex items-center gap-1.5 text-xs text-stone-600">
              <Package size={12} className="shrink-0 text-stone-400" />
              <span className="truncate font-medium">{order.customerName}</span>
              <span className="text-stone-300">·</span>
              <span className="shrink-0 text-stone-500">{itemCount} items</span>
            </div>

            <p className="mt-1.5 flex items-start gap-1 text-xs leading-relaxed text-stone-500">
              <MapPin size={12} className="mt-0.5 shrink-0 text-stone-400" />
              <span className="line-clamp-2">{order.deliveryAddress}</span>
            </p>

            {order.rider && (
              <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-violet-100">
                <Bike size={12} /> {order.rider.name}
              </p>
            )}

            <p className="mt-2.5 flex items-center gap-1 text-xs font-medium text-brand-700">
              View details <ChevronRight size={14} />
            </p>
          </div>
        </div>

        {canAdvance && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAdvance();
            }}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-stone-900 py-2 text-xs font-medium text-white transition hover:bg-brand-600"
          >
            {orderStatusLabel(nextStatus as OrderStatus, order.fulfillmentType)}
            <ArrowRight size={13} />
          </button>
        )}
      </div>
    </article>
  );
}
