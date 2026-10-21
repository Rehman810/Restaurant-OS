"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { DashboardSummary } from "@/lib/dashboard/types";
import { isRouteMissingError, loadApiCapabilities } from "@/lib/api-capabilities";
import { fetchDashboardSummaryFromLegacyStats } from "@/lib/legacy-api/dashboard-from-stats";
import { useLiveOrders } from "@/hooks/useLiveOrders";
import { playKitchenChime } from "@/lib/kitchen-chime";
import { readDashboardSoundEnabled } from "@/lib/dashboard/sound";
import { useBranch } from "@/modules/branches/BranchContext";

export type LiveState = "live" | "reconnecting" | "offline";

export function useDashboardSummary() {
  const { selection } = useBranch();
  const branchQuery = selection !== "all" ? selection : undefined;
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [live, setLive] = useState<LiveState>("offline");
  const [highlightOrderIds, setHighlightOrderIds] = useState<string[]>([]);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const path =
    branchQuery
      ? `/admin/dashboard/summary?branchId=${encodeURIComponent(branchQuery)}`
      : "/admin/dashboard/summary";

  const fetchSummary = useCallback(async () => {
    try {
      let summary: DashboardSummary;
      try {
        summary = await api<DashboardSummary>(path);
      } catch (err) {
        if (isRouteMissingError(err)) {
          await loadApiCapabilities(true);
          summary = await fetchDashboardSummaryFromLegacyStats(branchQuery);
        } else {
          throw err;
        }
      }
      const prevKnown = knownIdsRef.current;
      const incomingIds = summary.incomingOrders.map((o) => o.id);
      const newIds = incomingIds.filter((id) => prevKnown.size > 0 && !prevKnown.has(id));
      if (newIds.length) {
        setHighlightOrderIds((h) => [...new Set([...h, ...newIds])]);
        if (readDashboardSoundEnabled()) void playKitchenChime();
      }
      knownIdsRef.current = new Set(incomingIds);
      setData(summary);
      setError(null);
      setStale(false);
      setLive("live");
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 403
          ? e.message
          : e instanceof Error
            ? e.message
            : "Could not refresh dashboard";
      setError(msg);
      setStale(true);
      setLive("offline");
    } finally {
      setLoading(false);
    }
  }, [path]);

  const scheduleRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchSummary();
    }, 2000);
  }, [fetchSummary]);

  const liveOptions = useMemo(
    () => ({
      onCreated: () => {
        if (readDashboardSoundEnabled()) void playKitchenChime();
        scheduleRefresh();
      },
      onConnectChange: (connected: boolean) => {
        setLive(connected ? "live" : "reconnecting");
      },
    }),
    [scheduleRefresh]
  );

  useLiveOrders(scheduleRefresh, undefined, undefined, liveOptions);

  useEffect(() => {
    knownIdsRef.current = new Set();
    setLoading(true);
    void fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    const pollMs = 30_000;
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id) return;
      id = setInterval(() => {
        if (document.visibilityState === "visible") void fetchSummary();
      }, pollMs);
    };
    const stop = () => {
      if (id) clearInterval(id);
      id = null;
    };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        start();
        void fetchSummary();
      } else stop();
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchSummary]);

  const clearHighlight = useCallback((id: string) => {
    setHighlightOrderIds((h) => h.filter((x) => x !== id));
  }, []);

  return {
    data,
    loading,
    error,
    stale,
    live,
    refresh: fetchSummary,
    lastUpdated: data?.generatedAt ?? null,
    highlightOrderIds,
    clearHighlight,
  };
}
