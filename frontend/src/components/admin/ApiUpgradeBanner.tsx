"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { apiUpgradeMessage, getCachedApiCapabilities, loadApiCapabilities } from "@/lib/api-capabilities";

export function ApiUpgradeBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    void loadApiCapabilities().then((caps) => {
      const legacy =
        !caps.dashboardSummary || !caps.adminOrdersDispatch || caps.apiVersion < 2;
      setShow(legacy);
    });
  }, []);

  if (!show) return null;
  const caps = getCachedApiCapabilities();
  const missing: string[] = [];
  if (caps && !caps.adminOrdersDispatch) missing.push("orders dispatch");
  if (caps && !caps.dashboardSummary) missing.push("dashboard v2");
  if (caps && !caps.adminTracking) missing.push("live tracking");

  return (
    <div
      className="mb-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100"
      role="status"
    >
      <AlertTriangle size={18} className="mt-0.5 shrink-0" />
      <div>
        <p className="font-semibold">API upgrade recommended</p>
        <p className="mt-0.5 text-xs leading-relaxed opacity-90">
          {apiUpgradeMessage()}
          {missing.length ? ` Missing on server: ${missing.join(", ")}.` : null}
        </p>
      </div>
    </div>
  );
}
