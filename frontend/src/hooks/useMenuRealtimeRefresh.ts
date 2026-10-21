"use client";

import { useCallback, useRef } from "react";
import { useLiveOrders } from "@/hooks/useLiveOrders";

/** Refetch public menu when catalog or branch availability changes over Socket.IO. */
export function useMenuRealtimeRefresh(onRefresh: () => void) {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const schedule = useCallback(() => {
    window.setTimeout(() => onRefreshRef.current(), 400);
  }, []);

  useLiveOrders(schedule, undefined, undefined, {
    onMenuCatalogChanged: schedule,
    onMenuAvailabilityChanged: schedule,
  });
}
