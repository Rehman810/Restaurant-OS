"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { AdminOrderRow } from "@/lib/admin-orders/types";
import type { OrderBoardColumnView } from "@/lib/admin-orders/tracking";
import { mobileBoardTabIds } from "@/lib/admin-orders/mobile-board-tabs";
import { pkr } from "@/lib/format";
import type { Role } from "@/lib/types";
import { OrderBoardCard } from "./OrderBoardCard";
import type { BoardColumnId, SideColumnId } from "@/lib/admin-orders/board-columns";
import { canDropOnColumn, columnDropHighlight } from "@/lib/admin-orders/board-dnd";

export function OrderBoard({
  columns,
  cancelledToday = [],
  timeZone,
  serverTime,
  role,
  flashIds,
  onOpen,
  onAction,
  onAssignRider,
  onLongPress,
  selectedIds,
  onMoveCard,
  onOpenDuplicate,
  tvMode,
}: {
  columns: OrderBoardColumnView[];
  cancelledToday?: AdminOrderRow[];
  timeZone: string;
  serverTime: string;
  role?: Role;
  flashIds: Set<string>;
  onOpen: (row: AdminOrderRow) => void;
  onAction: (row: AdminOrderRow, action: AdminOrderRow["nextActions"][number]) => void;
  onAssignRider?: (row: AdminOrderRow) => void;
  onLongPress?: (row: AdminOrderRow) => void;
  selectedIds?: Set<string>;
  onMoveCard?: (orderId: string, columnId: BoardColumnId) => void;
  onOpenDuplicate?: (orderId: string) => void;
  tvMode?: boolean;
}) {
  const dragOrderRef = useRef<string | null>(null);
  const [draggingOrderId, setDraggingOrderId] = useState<string | null>(null);
  const [dropHighlightColumn, setDropHighlightColumn] = useState<BoardColumnId | null>(null);

  const allCards = useMemo(() => columns.flatMap((c) => c.cards), [columns]);

  function rowById(orderId: string | null) {
    if (!orderId) return null;
    return allCards.find((c) => c.id === orderId) ?? null;
  }

  const draggingRow = rowById(dragOrderRef.current ?? draggingOrderId);

  const allowDropDragOverRef = useRef<((e: DragEvent) => void) | null>(null);

  function endDrag() {
    if (allowDropDragOverRef.current) {
      window.removeEventListener("dragover", allowDropDragOverRef.current);
      allowDropDragOverRef.current = null;
    }
    dragOrderRef.current = null;
    setDraggingOrderId(null);
    setDropHighlightColumn(null);
  }

  function beginDrag(orderId: string, e: React.DragEvent) {
    e.dataTransfer.setData("text/plain", orderId);
    e.dataTransfer.setData("text/order-id", orderId);
    e.dataTransfer.effectAllowed = "move";
    dragOrderRef.current = orderId;
    setDraggingOrderId(orderId);
    if (!allowDropDragOverRef.current) {
      const onWinDragOver = (ev: DragEvent) => ev.preventDefault();
      allowDropDragOverRef.current = onWinDragOver;
      window.addEventListener("dragover", onWinDragOver);
    }
  }

  function columnAcceptsDrop(colId: BoardColumnId, orderId: string | null) {
    const row = rowById(orderId);
    return Boolean(row && onMoveCard && canDropOnColumn(colId, row));
  }
  const anchorMs = new Date(serverTime).getTime();
  const [sideOpen, setSideOpen] = useState(false);
  const mobileTabIds = useMemo(() => mobileBoardTabIds(columns), [columns]);
  const [mobileTab, setMobileTab] = useState<BoardColumnId | SideColumnId>("CONFIRMED");

  useEffect(() => {
    if (!mobileTabIds.includes(mobileTab)) {
      setMobileTab(mobileTabIds[0] ?? "CONFIRMED");
    }
  }, [mobileTabIds, mobileTab]);

  const columnMap = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);

  const pending = columnMap.get("PENDING_CONFIRMATION");
  const showPending = pending && pending.count > 0;

  const desktopColumns = columns.filter((c) => {
    if (c.id === "PENDING_CONFIRMATION") return showPending;
    return true;
  });

  const mobileColumn = columnMap.get(mobileTab);
  const mobileCards = mobileColumn?.cards ?? [];
  const mobileTabLabel = mobileColumn?.label ?? mobileTab;

  function renderCard(row: AdminOrderRow, columnId: BoardColumnId | SideColumnId) {
    const primary = row.nextActions.find((a) => a.primary);
    const canDrag =
      Boolean(onMoveCard) && columnId !== "CANCELLED" && columnId !== "PENDING_CONFIRMATION";
    return (
      <OrderBoardCard
        key={row.id}
        row={row}
        timeZone={timeZone}
        anchorMs={anchorMs}
        role={role}
        flash={flashIds.has(row.id)}
        selected={selectedIds?.has(row.id)}
        onOpen={() => onOpen(row)}
        onAction={() => primary && onAction(row, primary)}
        onAssignRider={onAssignRider ? () => onAssignRider(row) : undefined}
        onLongPress={onLongPress ? () => onLongPress(row) : undefined}
        onOpenDuplicate={onOpenDuplicate}
        tvMode={tvMode}
        draggable={canDrag}
        onDragStart={(e) => beginDrag(row.id, e)}
        onDragEnd={endDrag}
      />
    );
  }

  function columnSection(col: OrderBoardColumnView, className: string) {
    const colId = col.id as BoardColumnId;
    const activeOrderId = dragOrderRef.current ?? draggingOrderId;
    const dropHint = columnDropHighlight(colId, draggingRow);
    const isDropTarget =
      dropHighlightColumn === colId || (Boolean(activeOrderId) && dropHint === "target");
    const isDropDisabled = Boolean(activeOrderId) && dropHint === "disabled";
    return (
      <section
        key={col.id}
        className={`${className} transition-[opacity,box-shadow] ${
          isDropTarget ? "ring-2 ring-brand-500 ring-offset-2" : ""
        } ${isDropDisabled ? "opacity-40" : ""}`}
        aria-label={`${col.label} column`}
        onDragEnter={(e) => {
          if (!columnAcceptsDrop(colId, activeOrderId)) return;
          e.preventDefault();
          setDropHighlightColumn(colId);
        }}
        onDragOver={(e) => {
          const orderId = dragOrderRef.current ?? draggingOrderId;
          if (!columnAcceptsDrop(colId, orderId)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDropHighlightColumn(colId);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setDropHighlightColumn((c) => (c === colId ? null : c));
        }}
        onDrop={(e) => {
          e.preventDefault();
          const orderId =
            e.dataTransfer.getData("text/order-id") || e.dataTransfer.getData("text/plain");
          endDrag();
          if (!orderId || !onMoveCard) return;
          const row = rowById(orderId);
          if (row && canDropOnColumn(colId, row)) onMoveCard(orderId, colId);
        }}
      >
        <header className="sticky top-0 z-[1] rounded-t-2xl border-b border-stone-200/80 bg-stone-50/95 px-3 py-2 backdrop-blur dark:border-stone-700 dark:bg-stone-900/95">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-xs font-bold uppercase tracking-wide text-stone-600 dark:text-stone-300">
              {col.label}
              {isDropTarget && (
                <span className="ml-1 font-semibold normal-case text-brand-600 dark:text-brand-300">
                  · Drop here
                </span>
              )}
            </h3>
            <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-stone-600 ring-1 ring-stone-200 dark:bg-stone-800 dark:text-stone-200 dark:ring-stone-600">
              {col.count}
            </span>
          </div>
          {col.id !== "COMPLETED" && col.value != null && col.value > 0 && (
            <p className="mt-0.5 text-[11px] text-stone-500">{pkr(col.value)}</p>
          )}
          {col.historyLink && (
            <Link
              href={col.historyLink}
              className="mt-1 inline-block text-[11px] font-semibold text-brand-700 hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-brand-300"
              onClick={(e) => e.stopPropagation()}
            >
              View history
            </Link>
          )}
        </header>
        <div
          className="flex max-h-[min(70vh,720px)] min-h-[80px] flex-col gap-2 overflow-y-auto p-2"
          onDragOver={(e) => {
            const orderId = dragOrderRef.current ?? draggingOrderId;
            if (!columnAcceptsDrop(colId, orderId)) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "move";
            setDropHighlightColumn(colId);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const orderId =
              e.dataTransfer.getData("text/order-id") || e.dataTransfer.getData("text/plain");
            endDrag();
            if (!orderId || !onMoveCard) return;
            const row = rowById(orderId);
            if (row && canDropOnColumn(colId, row)) onMoveCard(orderId, colId);
          }}
        >
          {col.cards.map((row) => renderCard(row, col.id))}
          {!col.cards.length && (
            <p className="py-4 text-center text-xs text-stone-400">No orders</p>
          )}
        </div>
      </section>
    );
  }

  const boardSelectLock = draggingOrderId ? "select-none" : "";

  return (
    <>
      {/* Desktop: all columns */}
      <div
        className={`hidden min-h-0 max-w-full flex-1 gap-2 xl:flex xl:max-h-[calc(100dvh-11rem)] ${boardSelectLock}`}
      >
        {desktopColumns.map((col) =>
          columnSection(
            col,
            "flex min-w-0 flex-1 flex-col rounded-2xl border border-stone-200/80 bg-stone-50/50 dark:border-stone-700 dark:bg-stone-900/40"
          )
        )}

        {(cancelledToday.length > 0 || sideOpen) && (
          <aside className="flex w-[min(100%,220px)] shrink-0 flex-col">
            <button
              type="button"
              className="flex min-h-[44px] items-center justify-between rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700 focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-200"
              onClick={() => setSideOpen((o) => !o)}
              aria-expanded={sideOpen}
            >
              Cancelled today ({cancelledToday.length})
              <ChevronDown size={16} className={sideOpen ? "rotate-180" : ""} aria-hidden />
            </button>
            {sideOpen && (
              <div className="mt-2 flex max-h-[min(60vh,480px)] flex-col gap-2 overflow-y-auto">
                {cancelledToday.map((row) => renderCard(row, "CANCELLED"))}
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Tablet: 2–3 columns with horizontal snap */}
      <div
        className={`hidden max-w-full snap-x snap-mandatory gap-3 overflow-x-auto pb-2 md:flex xl:hidden ${boardSelectLock}`}
        aria-label="Order board columns"
      >
        {desktopColumns.map((col) =>
          columnSection(
            col,
            "flex w-[min(42vw,320px)] shrink-0 snap-start flex-col rounded-2xl border border-stone-200/80 bg-stone-50/50 dark:border-stone-700 dark:bg-stone-900/40"
          )
        )}
      </div>

      {/* Phone: single column tabs */}
      <div className="max-w-full space-y-3 md:hidden">
        <div
          className="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Order status lanes"
        >
          {mobileTabIds.map((id) => {
            const col = columnMap.get(id);
            const count = col?.count ?? 0;
            const active = mobileTab === id;
            const tabId = `board-tab-${id}`;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={tabId}
                aria-selected={active}
                aria-controls="board-tabpanel"
                className={`shrink-0 rounded-full px-3 py-2.5 text-xs font-bold ring-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
                  active
                    ? "bg-brand-50 text-brand-900 ring-brand-200 dark:bg-brand-950/50 dark:text-brand-100"
                    : "bg-white text-stone-600 ring-stone-200 dark:bg-stone-900 dark:text-stone-300"
                }`}
                onClick={() => setMobileTab(id)}
              >
                {col?.label ?? id}
                <span className="ml-1 opacity-70">({count})</span>
              </button>
            );
          })}
        </div>
        <div
          id="board-tabpanel"
          role="tabpanel"
          aria-labelledby={`board-tab-${mobileTab}`}
          className="flex flex-col gap-3"
          style={{ paddingBottom: "max(5rem, env(safe-area-inset-bottom))" }}
        >
          {mobileCards.map((row) => renderCard(row, mobileTab))}
          {!mobileCards.length && (
            <p className="py-8 text-center text-sm text-stone-500">No orders in {mobileTabLabel}.</p>
          )}
        </div>
      </div>
    </>
  );
}
