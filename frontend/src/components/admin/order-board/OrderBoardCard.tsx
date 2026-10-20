"use client";

import { useRef } from "react";
import { AlertTriangle, Bike, Copy, GripVertical, Phone } from "lucide-react";
import { useLongPress } from "@/hooks/useLongPress";

/** HTML5 drag may start from the card body or grip; never from buttons/links. */
function canStartCardDrag(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  if (target.closest("[data-drag-handle]")) return true;
  return !target.closest("button, a, input, select, textarea, [role='button']");
}
import type { AdminOrderRow } from "@/lib/admin-orders/types";
import {
  completedOutcomeLabel,
  formatAgeCompact,
  formatStoreTime12h,
  paymentBadgeLabel,
} from "@/lib/admin-orders/helpers";
import { typeBadgeShort } from "@/lib/admin-orders/board-columns";
import { pkr } from "@/lib/format";
import type { Role } from "@/lib/types";

export function OrderBoardCard({
  row,
  timeZone,
  anchorMs,
  role,
  flash,
  onOpen,
  onAction,
  onAssignRider,
  onLongPress,
  onOpenDuplicate,
  selected,
  tvMode,
  draggable,
  onDragStart,
  onDragEnd,
}: {
  row: AdminOrderRow;
  timeZone: string;
  anchorMs: number;
  role?: Role;
  flash?: boolean;
  onOpen: () => void;
  onAction: () => void;
  onAssignRider?: () => void;
  onLongPress?: () => void;
  onOpenDuplicate?: (orderId: string) => void;
  selected?: boolean;
  tvMode?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
}) {
  const primary = row.nextActions.find((a) => a.primary);
  const elapsed = Math.floor((Date.now() - anchorMs) / 1000);
  const ageSec = row.ageSeconds + elapsed;
  const ageLabel = formatAgeCompact(ageSec);
  const exactTime = formatStoreTime12h(row.statusChangedAt, timeZone);
  const showPayment = role !== "CHEF" && row.payment;
  const showPhone = role !== "CHEF" && !row.customer.phoneMasked && row.customer.phone;
  const canCardDrag = Boolean(draggable && onDragStart);
  const didDrag = useRef(false);

  function openUnlessDragged() {
    if (!didDrag.current) onOpen();
  }

  const longPress = useLongPress({
    onClick: openUnlessDragged,
    onLongPress: () => onLongPress?.(),
  });

  const borderTone = row.isStale
    ? "border-amber-500 ring-1 ring-amber-200 dark:ring-amber-900"
    : row.isLate
      ? "border-red-500 ring-1 ring-red-200 dark:ring-red-900"
      : "border-stone-200 dark:border-stone-700";

  function whereLine() {
    if (row.type === "DINE_IN") {
      const table = row.table?.trim();
      return (
        <p className="text-sm text-stone-600 dark:text-stone-300">
          {table ? (
            <span className="font-bold text-stone-900 dark:text-stone-50">Table {table}</span>
          ) : (
            <span className="font-semibold text-amber-800 dark:text-amber-200">No table</span>
          )}
        </p>
      );
    }
    if (row.type === "PICKUP") {
      return <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">Pickup</p>;
    }
    const area = row.address?.area;
    const text = row.address?.text ?? "Delivery";
    return (
      <p className="line-clamp-2 text-sm text-stone-600 dark:text-stone-300">
        {text}
        {area ? <span className="text-stone-500"> · {area}</span> : null}
        {row.zoneWarning && (
          <span className="ml-1 inline-flex items-center gap-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
            <AlertTriangle size={12} aria-hidden /> Outside zone
          </span>
        )}
      </p>
    );
  }

  async function copyNumber(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(row.number);
    } catch {
      /* ignore */
    }
  }

  const shellClass = `relative rounded-xl border bg-white shadow-sm dark:bg-stone-900 ${borderTone} ${
    flash ? "motion-safe:animate-pulse motion-reduce:ring-2 motion-reduce:ring-brand-400" : ""
  } ${selected ? "ring-2 ring-brand-500" : ""} focus-within:ring-2 focus-within:ring-brand-400 ${
    canCardDrag ? "touch-none select-none" : ""
  }`;

  return (
    <div
      draggable={canCardDrag}
      className={`${shellClass} ${canCardDrag ? "cursor-grab active:cursor-grabbing active:opacity-95" : ""}`}
      onDragStart={(e) => {
        if (!canCardDrag || !canStartCardDrag(e.target)) {
          e.preventDefault();
          return;
        }
        didDrag.current = true;
        onDragStart!(e);
      }}
      onDragEnd={() => {
        onDragEnd?.();
        window.setTimeout(() => {
          didDrag.current = false;
        }, 0);
      }}
    >
      {canCardDrag && (
        <div
          data-drag-handle
          className="absolute bottom-0 left-0 top-0 z-[1] flex w-9 cursor-grab items-start justify-center pt-3 text-stone-300 active:cursor-grabbing dark:text-stone-600"
          title="Drag to next column"
          aria-hidden
        >
          <GripVertical size={18} />
        </div>
      )}
      <article
        className={`${tvMode ? "p-4" : "p-3"} ${canCardDrag ? "pl-8" : ""}`}
        {...(onLongPress ? longPress.handlers : {})}
        onClick={onLongPress ? undefined : openUnlessDragged}
        tabIndex={0}
        role="group"
        aria-label={`Order ${row.shortDisplay}, ${typeBadgeShort(row.type)}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        onContextMenu={(e) => {
          if (!onLongPress) return;
          e.preventDefault();
          onLongPress();
        }}
      >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`font-display font-bold text-stone-900 dark:text-stone-50 ${
                tvMode ? "text-2xl" : "text-lg"
              }`}
            >
              {row.shortDisplay}
            </span>
            <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-stone-600 dark:bg-stone-800 dark:text-stone-300">
              {typeBadgeShort(row.type)}
            </span>
            {row.status === "DELIVERED" || row.status === "COLLECTED" || row.status === "SERVED" ? (
              <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200">
                {completedOutcomeLabel(row.outcome, row.status)}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className="mt-0.5 flex max-w-full items-center gap-1 text-[10px] text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
            onClick={copyNumber}
            title={`Full number ${row.number}`}
          >
            <span className="truncate">{row.number}</span>
            <Copy size={11} aria-hidden />
          </button>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold text-stone-900 dark:text-stone-50">{pkr(row.totals.total)}</p>
          <p className="text-xs font-medium text-stone-500" title={exactTime}>
            {ageLabel}
          </p>
        </div>
      </div>

      {row.possibleDuplicateOf && onOpenDuplicate && (
        <button
          type="button"
          className="mt-1 text-left text-[10px] font-bold text-amber-800 underline dark:text-amber-300"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDuplicate(row.possibleDuplicateOf!);
          }}
        >
          Possible duplicate
        </button>
      )}

      {(row.isLate || row.isStale) && (
        <div className="mt-1 flex flex-wrap gap-1">
          {row.isLate && (
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-800 dark:bg-red-950/50 dark:text-red-200">
              Late
            </span>
          )}
          {row.isStale && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
              Stale
            </span>
          )}
        </div>
      )}

      <p className="mt-1.5 line-clamp-2 text-xs text-stone-600 dark:text-stone-300">
        {row.itemsSummary.lines.map((l) => `${l.quantity}× ${l.name}`).join(", ")}
        {row.itemsSummary.extraCount > 0 ? ` +${row.itemsSummary.extraCount} more` : ""}
        {row.notes.hasAllergyHint && (
          <span className="ml-1 font-semibold text-amber-700 dark:text-amber-300">· Allergy</span>
        )}
        {row.notes.hasNotes && (
          <span className="ml-1 font-semibold text-stone-500">· Note</span>
        )}
      </p>

      <div className="mt-1.5">{whereLine()}</div>

      {row.rider && (
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          <Bike size={12} className="mr-0.5 inline" aria-hidden />
          {row.rider.name}
          {row.riderOutSinceSeconds != null && row.riderOutSinceSeconds > 0 && (
            <span> · Out {formatAgeCompact(row.riderOutSinceSeconds)}</span>
          )}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        {showPayment && (
          <span className="truncate text-[11px] font-semibold text-stone-600 dark:text-stone-400">
            {paymentBadgeLabel(row)}
          </span>
        )}
        {showPhone && (
          <a
            href={`tel:${row.customer.phone.replace(/\s/g, "")}`}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 dark:border-stone-600 dark:text-stone-300"
            aria-label={`Call ${row.customer.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            <Phone size={18} />
          </a>
        )}
      </div>

      {row.needsRider && onAssignRider && (role === "ADMIN" || role === "MANAGER") && (
        <button
          type="button"
          className="btn-secondary mt-2 min-h-[44px] w-full text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onAssignRider();
          }}
        >
          Assign rider
        </button>
      )}

      {primary && (
        <button
          type="button"
          className="btn-primary mt-2 min-h-[48px] w-full text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 md:min-h-[44px] md:text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onAction();
          }}
        >
          {primary.label}
        </button>
      )}
      </article>
    </div>
  );
}
