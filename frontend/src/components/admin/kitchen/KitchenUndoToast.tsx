"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";

export function KitchenUndoToast({
  message,
  expiresAt,
  onUndo,
  onDone,
}: {
  message: string;
  expiresAt: number;
  onUndo: () => void;
  onDone: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
  );

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) onDone();
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [expiresAt, onDone]);

  if (secondsLeft <= 0) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 z-50 flex w-[min(100%,28rem)] -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-lg dark:border-stone-600 dark:bg-stone-900"
      role="status"
    >
      <p className="text-sm font-medium text-stone-800 dark:text-stone-100">
        {message} <span className="text-stone-400">({secondsLeft}s)</span>
      </p>
      <button
        type="button"
        onClick={onUndo}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-stone-900 px-3 py-2 text-sm font-bold text-white dark:bg-stone-100 dark:text-stone-900"
      >
        <RotateCcw size={15} />
        Undo
      </button>
    </div>
  );
}
