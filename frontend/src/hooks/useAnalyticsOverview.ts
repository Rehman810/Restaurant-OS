"use client";

import { useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { apiUpgradeMessage, isRouteMissingError, loadApiCapabilities } from "@/lib/api-capabilities";
import type { AnalyticsOverview, AnalyticsPreset, CompareMode } from "@/lib/analytics/types";
import { usePoll } from "@/hooks/usePoll";

export type AnalyticsQuery = {
  preset: AnalyticsPreset;
  from?: string;
  to?: string;
  compare: CompareMode;
  page?: number;
};

function buildQueryString(q: AnalyticsQuery) {
  const p = new URLSearchParams();
  p.set("preset", q.preset);
  if (q.preset === "custom" && q.from) p.set("from", q.from);
  if (q.preset === "custom" && q.to) p.set("to", q.to);
  p.set("compare", q.compare);
  if (q.page) p.set("page", String(q.page));
  return p.toString();
}

export function useAnalyticsOverview(query: AnalyticsQuery) {
  const qs = useMemo(() => buildQueryString(query), [query]);
  const fetcher = useCallback(async () => {
    try {
      return await api<AnalyticsOverview>(`/admin/analytics/overview?${qs}`);
    } catch (err) {
      if (isRouteMissingError(err)) {
        await loadApiCapabilities(true);
        throw new Error(apiUpgradeMessage());
      }
      throw err;
    }
  }, [qs]);
  const poll = usePoll(fetcher, 60_000);
  return poll;
}
