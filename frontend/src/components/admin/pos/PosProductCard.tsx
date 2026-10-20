"use client";

import { memo, useCallback, useRef, useState } from "react";
import { SlidersHorizontal, Star } from "lucide-react";
import type { MenuItem } from "@/lib/types";
import { menuItemPrice, itemHasConfigurableOptions } from "@/lib/menu-price";
import { pkr } from "@/lib/format";
import { itemInitial, type PosMenuDensity } from "@/lib/pos/menu-preferences";

type Props = {
  item: MenuItem;
  density: PosMenuDensity;
  pinned?: boolean;
  canMark86?: boolean;
  onTap: () => void;
  onLongPress?: () => void;
  onTogglePin?: () => void;
};

function PosMenuImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="grid h-full w-full place-items-center bg-gradient-to-br from-brand-50 to-brand-100/80 dark:from-stone-800 dark:to-stone-900">
        <span className="text-2xl font-black text-brand-700/80 dark:text-brand-300/80">{alt.slice(0, 1)}</span>
      </div>
    );
  }

  return (
    <>
      <div
        className="absolute inset-0 animate-pulse bg-gradient-to-br from-stone-100 to-stone-200/80 dark:from-stone-800 dark:to-stone-700"
        aria-hidden
        style={{ opacity: loaded ? 0 : 1, transition: "opacity 200ms ease-out" }}
      />
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className="relative h-full w-full object-cover"
        style={{
          opacity: loaded ? 1 : 0,
          transition: "opacity 200ms ease-out",
        }}
      />
    </>
  );
}

export const PosProductCard = memo(function PosProductCard({
  item,
  density,
  pinned,
  canMark86,
  onTap,
  onLongPress,
  onTogglePin,
}: Props) {
  const price = menuItemPrice(item);
  const hasOptions = itemHasConfigurableOptions(item) || (item.optionGroups?.length ?? 0) > 0;
  const soldOut = !item.isAvailable;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const onTouchStart = useCallback(() => {
    if (!onLongPress) return;
    clearTimer();
    timerRef.current = setTimeout(() => {
      onLongPress();
      clearTimer();
    }, 550);
  }, [onLongPress]);

  if (density === "compact") {
    return (
      <button
        type="button"
        disabled={soldOut}
        onClick={onTap}
        onContextMenu={(e) => {
          if (onLongPress) {
            e.preventDefault();
            onLongPress();
          }
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={clearTimer}
        onTouchMove={clearTimer}
        className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left ${
          soldOut
            ? "border-stone-200 bg-stone-100 opacity-60 dark:border-stone-700 dark:bg-stone-800"
            : "border-stone-200 bg-white dark:border-stone-600 dark:bg-stone-800"
        }`}
      >
        <span className="min-w-0 truncate text-sm font-semibold text-stone-900 dark:text-stone-50">{item.name}</span>
        <span className="shrink-0 text-sm font-bold tabular-nums text-brand-700 dark:text-brand-300">{pkr(price)}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={soldOut}
      onClick={onTap}
      onContextMenu={(e) => {
        if (onLongPress) {
          e.preventDefault();
          onLongPress();
        }
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={clearTimer}
      onTouchMove={clearTimer}
      className={`group relative flex flex-col overflow-hidden rounded-xl border text-left shadow-sm [content-visibility:auto] [contain-intrinsic-size:180px] active:scale-[0.98] sm:rounded-2xl ${
        soldOut
          ? "border-stone-200 bg-stone-100 opacity-70 dark:border-stone-700 dark:bg-stone-800"
          : "border-stone-200/80 bg-white dark:border-stone-600 dark:bg-stone-800 sm:hover:border-brand-300 sm:hover:shadow-md dark:sm:hover:border-brand-500"
      }`}
    >
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-gradient-to-br from-brand-50 to-brand-100/80 dark:from-stone-800 dark:to-stone-900">
        {item.imageUrl ? (
          <PosMenuImage src={item.imageUrl} alt={item.name} />
        ) : (
          <div className="grid h-full place-items-center text-brand-700/80 dark:text-brand-300/80">
            <span className="text-2xl font-black">{itemInitial(item.name)}</span>
          </div>
        )}
        {soldOut && (
          <span className="absolute inset-0 grid place-items-center bg-stone-900/40 text-xs font-bold uppercase tracking-wide text-white">
            Sold out
          </span>
        )}
        {hasOptions && !soldOut && (
          <span className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded bg-white/95 px-1.5 py-0.5 text-[9px] font-semibold text-stone-700 shadow-sm sm:left-2 sm:top-2">
            <SlidersHorizontal size={10} aria-hidden /> Options
          </span>
        )}
        {pinned && (
          <span className="absolute right-1.5 top-1.5 rounded-full bg-amber-400 p-1 text-amber-950 shadow-sm">
            <Star size={10} fill="currentColor" aria-label="Pinned" />
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-2 sm:p-2.5">
        <p className="line-clamp-2 text-xs font-bold leading-snug text-stone-900 dark:text-stone-50 sm:text-[13px]">{item.name}</p>
        <p className="mt-1 text-xs font-bold tabular-nums text-brand-700 dark:text-brand-300">{pkr(price)}</p>
      </div>
      {canMark86 && onTogglePin && (
        <span className="sr-only">Long-press for actions</span>
      )}
    </button>
  );
});
