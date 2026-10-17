"use client";

import { useEffect, useState, type DragEvent, type Dispatch, type SetStateAction } from "react";
import { api } from "@/lib/api";
import { pkr } from "@/lib/format";
import { STATUS_THEME } from "@/lib/admin-status";
import {
  ADMIN_KANBAN_COLUMNS,
  canMoveForward,
  isBackwardMove,
  isOrderTerminal,
  nextOrderStatus,
  Order,
  OrderStatus,
  STATUS_LABEL,
} from "@/lib/types";
import { KanbanCard } from "./KanbanCard";
import { OrderDetailSheet } from "./OrderDetailSheet";

const COLUMNS: OrderStatus[] = ADMIN_KANBAN_COLUMNS;

function columnDropHandlers(
  columnStatus: OrderStatus,
  draggingOrder: Order | null,
  setDragOver: Dispatch<SetStateAction<OrderStatus | null>>,
  onDropOrder: (orderId: string, status: OrderStatus) => void
) {
  const draggingStatus = draggingOrder?.status ?? null;
  const canDrop =
    draggingOrder !== null &&
    draggingStatus !== null &&
    canMoveForward(draggingStatus, columnStatus, draggingOrder.fulfillmentType);
  const isSameColumn = draggingStatus === columnStatus;

  return {
    onDragEnter: (e: DragEvent) => {
      e.preventDefault();
      if (canDrop) setDragOver(columnStatus);
    },
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      if (canDrop) {
        e.dataTransfer.dropEffect = "move";
        setDragOver(columnStatus);
      } else if (
        isSameColumn ||
        (draggingOrder && draggingStatus && isBackwardMove(draggingStatus, columnStatus, draggingOrder.fulfillmentType))
      ) {
        e.dataTransfer.dropEffect = "none";
      }
    },
    onDragLeave: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        setDragOver((prev) => (prev === columnStatus ? null : prev));
      }
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(null);
      if (!canDrop) return;
      const orderId = e.dataTransfer.getData("text/plain");
      if (orderId) onDropOrder(orderId, columnStatus);
    },
  };
}

export function KanbanBoard({
  orders,
  onRefresh,
  className = "",
}: {
  orders: Order[];
  onRefresh: () => void;
  className?: string;
}) {
  const [localOrders, setLocalOrders] = useState(orders);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<OrderStatus | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setLocalOrders(orders);
  }, [orders]);

  const draggingOrder = localOrders.find((o) => o.id === draggingId) ?? null;
  const draggingStatus = draggingOrder?.status ?? null;
  const selectedOrder = localOrders.find((o) => o.id === selectedId) ?? null;

  async function moveOrder(orderId: string, status: OrderStatus) {
    const order = localOrders.find((o) => o.id === orderId);
    if (!order || order.status === status) return;

    if (!canMoveForward(order.status, status, order.fulfillmentType)) {
      setError("Orders can only move forward — not back to an earlier stage.");
      return;
    }

    const previous = localOrders;
    setError("");
    setMovingId(orderId);
    setLocalOrders((list) => list.map((o) => (o.id === orderId ? { ...o, status } : o)));

    try {
      await api(`/orders/${orderId}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      onRefresh();
    } catch (e) {
      setLocalOrders(previous);
      setError(e instanceof Error ? e.message : "Could not move order");
    } finally {
      setMovingId(null);
      setDraggingId(null);
      setDragOver(null);
    }
  }

  async function advance(order: Order) {
    const next = nextOrderStatus(order.status, order.fulfillmentType);
    if (!next) return;
    await moveOrder(order.id, next);
  }

  return (
    <>
      {error && (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className={`flex h-full min-h-0 gap-3 overflow-hidden ${className}`}>
        {COLUMNS.map((status) => {
          const theme = STATUS_THEME[status];
          const list = localOrders.filter((o) => o.status === status);
          const isOver = dragOver === status;
          const canDropHere =
            draggingOrder !== null &&
            draggingStatus !== null &&
            canMoveForward(draggingStatus, status, draggingOrder.fulfillmentType);
          const isBackward =
            draggingOrder !== null &&
            draggingStatus !== null &&
            isBackwardMove(draggingStatus, status, draggingOrder.fulfillmentType);
          const columnValue = list.reduce((sum, o) => sum + Number(o.total), 0);
          const dropHandlers = columnDropHandlers(status, draggingOrder ?? null, setDragOver, moveOrder);

          return (
            <div
              key={status}
              className={`relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${
                isBackward ? "kanban-col-disabled" : ""
              }`}
            >
              {isBackward && (
                <div
                  className="pointer-events-none absolute inset-0 z-10 rounded-2xl bg-stone-100/50"
                  aria-hidden
                />
              )}
              <div className={`shrink-0 rounded-t-2xl border border-b-0 px-4 py-3 ${theme.border} ${theme.bg}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${theme.dot}`} />
                    <h2 className="truncate text-sm font-semibold text-stone-800 dark:text-stone-100">
                      {STATUS_LABEL[status]}
                    </h2>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${theme.bg} ${theme.text} ${theme.ring}`}
                  >
                    {list.length}
                  </span>
                </div>
                {list.length > 0 && (
                  <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{pkr(columnValue)} in column</p>
                )}
              </div>

              <div
                {...dropHandlers}
                className={`kanban-scroll flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain rounded-b-2xl border border-t-0 p-2 transition ${
                  isOver && canDropHere
                    ? `border-2 border-dashed ${theme.border} ${theme.bg} ring-2 ${theme.ring}`
                    : "border-stone-200/80 bg-white shadow-inner dark:border-stone-700 dark:bg-stone-900/60 dark:shadow-none"
                }`}
              >
                {list.length === 0 && (
                  <div className="flex min-h-[140px] flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-stone-200 bg-stone-50/80 px-4 py-10 text-center dark:border-stone-600 dark:bg-stone-800/50">
                    <div className={`mb-3 grid h-10 w-10 place-items-center rounded-full ${theme.bg}`}>
                      <span className={`h-2.5 w-2.5 rounded-full ${theme.dot}`} />
                    </div>
                    <p className="text-sm font-medium text-stone-500 dark:text-stone-300">No orders</p>
                    <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
                      {canDropHere ? "Drop a card here" : ""}
                    </p>
                  </div>
                )}

                {list.map((order) => (
                  <KanbanCard
                    key={order.id}
                    order={order}
                    dragging={draggingId === order.id}
                    moving={movingId === order.id}
                    onSelect={() => setSelectedId(order.id)}
                    onAdvance={() => advance(order)}
                    onDragStart={() => setDraggingId(order.id)}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDragOver(null);
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selectedOrder && (
        <OrderDetailSheet order={selectedOrder} onClose={() => setSelectedId(null)} />
      )}
    </>
  );
}

export function kanbanActiveCount(orders: Order[]) {
  return orders.filter((o) => !isOrderTerminal(o.status) && o.status !== "CANCELLED").length;
}
