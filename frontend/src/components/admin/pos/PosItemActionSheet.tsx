"use client";

import type { MenuItem } from "@/lib/types";

type Props = {
  item: MenuItem | null;
  pinned: boolean;
  canMark86: boolean;
  canPin: boolean;
  onClose: () => void;
  onMarkSoldOut: () => void;
  onMarkAvailable: () => void;
  onTogglePin: () => void;
};

export function PosItemActionSheet({
  item,
  pinned,
  canMark86,
  canPin,
  onClose,
  onMarkSoldOut,
  onMarkAvailable,
  onTogglePin,
}: Props) {
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-stone-950/50 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl dark:bg-stone-900">
        <p className="font-bold text-stone-900 dark:text-stone-50">{item.name}</p>
        <div className="mt-3 grid gap-2">
          {canMark86 && item.isAvailable && (
            <button type="button" className="btn-ghost w-full justify-start text-rose-700" onClick={onMarkSoldOut}>
              Mark sold out (86)
            </button>
          )}
          {canMark86 && !item.isAvailable && (
            <button type="button" className="btn-ghost w-full justify-start text-emerald-700" onClick={onMarkAvailable}>
              Mark available again
            </button>
          )}
          {canPin && (
            <button type="button" className="btn-ghost w-full justify-start" onClick={onTogglePin}>
              {pinned ? "Unpin from favourites" : "Pin to favourites"}
            </button>
          )}
          <button type="button" className="btn-ghost w-full" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
