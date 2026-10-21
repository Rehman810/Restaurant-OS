"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { useAdminSidebarInsetLeft } from "@/hooks/useAdminSidebarInset";

export function SettingsSaveBar({
  changeCount,
  saving,
  disabled,
  onSave,
  onDiscard,
}: {
  changeCount: number;
  saving: boolean;
  disabled?: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const sidebarLeft = useAdminSidebarInsetLeft();
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  if (changeCount <= 0) return null;

  return (
    <div
      className="fixed right-0 z-40 border-t border-stone-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-md dark:border-stone-700 dark:bg-stone-900/95"
      style={{
        left: desktop ? sidebarLeft : 0,
        bottom: desktop ? 0 : `calc(3.5rem + env(safe-area-inset-bottom))`,
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
      }}
      role="region"
      aria-label="Unsaved settings"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-stone-800 dark:text-stone-100">
          {changeCount === 1 ? "1 unsaved change" : `${changeCount} unsaved changes`}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="btn-ghost min-h-11 flex-1 px-4 sm:flex-none"
            onClick={onDiscard}
            disabled={saving}
          >
            Discard
          </button>
          <button
            type="button"
            className="btn-primary min-h-11 inline-flex flex-1 items-center justify-center gap-2 sm:flex-none"
            onClick={onSave}
            disabled={disabled || saving}
          >
            <Save size={16} aria-hidden />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
