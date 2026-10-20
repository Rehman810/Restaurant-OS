"use client";

import { Volume2 } from "lucide-react";

export function KitchenSoundBanner({ onEnable }: { onEnable: () => void }) {
  return (
    <button
      type="button"
      onClick={onEnable}
      className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-4 text-center shadow-sm transition hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/50 dark:hover:bg-amber-950/70"
    >
      <Volume2 size={28} className="shrink-0 text-amber-700 dark:text-amber-300" />
      <span className="text-lg font-bold text-amber-950 dark:text-amber-100">Tap to enable sound alerts</span>
    </button>
  );
}
