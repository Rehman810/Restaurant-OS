"use client";

import { Trash2 } from "lucide-react";
import type { PosLine } from "@/lib/pos-cart";
import { pkr } from "@/lib/format";

type Props = {
  open: boolean;
  line: PosLine | null;
  onClose: () => void;
  onNoteChange: (note: string) => void;
  onRemove: () => void;
  onEditPrice: () => void;
  onEditModifiers?: () => void;
  canEditModifiers: boolean;
};

export function PosLineSheet({
  open,
  line,
  onClose,
  onNoteChange,
  onRemove,
  onEditPrice,
  onEditModifiers,
  canEditModifiers,
}: Props) {
  if (!open || !line) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-stone-950/50 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl dark:bg-stone-900">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-stone-900 dark:text-stone-50">{line.name}</h3>
            <p className="text-sm text-stone-500">{pkr(line.price)} × {line.quantity}</p>
          </div>
          <button type="button" className="text-sm font-semibold text-stone-500" onClick={onClose}>
            Close
          </button>
        </div>
        {line.optionsLabel && line.optionsLabel !== line.name && (
          <p className="mt-2 text-xs text-stone-500">{line.optionsLabel}</p>
        )}
        <label className="mt-4 block text-xs font-semibold text-stone-600 dark:text-stone-300">
          Line note
          <textarea
            className="input mt-1 min-h-[72px] w-full text-sm"
            value={line.instructions ?? ""}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="e.g. extra spicy"
          />
        </label>
        <div className="mt-4 grid gap-2">
          {canEditModifiers && onEditModifiers && (
            <button type="button" className="btn-ghost w-full" onClick={onEditModifiers}>
              Edit modifiers
            </button>
          )}
          <button type="button" className="btn-ghost w-full" onClick={onEditPrice}>
            Override unit price
          </button>
          <button
            type="button"
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 text-sm font-semibold text-rose-700"
            onClick={onRemove}
          >
            <Trash2 size={16} /> Remove line
          </button>
        </div>
      </div>
    </div>
  );
}
