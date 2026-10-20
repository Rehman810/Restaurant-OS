"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useLiveOrders } from "@/hooks/useLiveOrders";
import type { KitchenAlertEvent } from "@/lib/admin-kitchen";

export function OpsKitchenAlertBanner() {
  const [alert, setAlert] = useState<KitchenAlertEvent | null>(null);

  useEffect(() => {
    if (!alert) return;
    const id = window.setTimeout(() => setAlert(null), 20_000);
    return () => window.clearTimeout(id);
  }, [alert]);

  useLiveOrders(() => {}, undefined, undefined, {
    onKitchenAlert: (payload) => setAlert(payload as KitchenAlertEvent),
  });

  if (!alert) return null;

  return (
    <div
      className="flex items-start justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/60"
      role="alert"
    >
      <div className="flex gap-2">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" />
        <p className="font-semibold text-amber-950 dark:text-amber-100">{alert.message}</p>
      </div>
      <button
        type="button"
        onClick={() => setAlert(null)}
        className="shrink-0 rounded-lg p-1 text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}
