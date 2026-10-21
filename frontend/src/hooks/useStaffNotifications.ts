"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  clearStaffNotifications,
  getStaffNotifications,
  markAllStaffNotificationsRead,
  markStaffNotificationRead,
  pushStaffNotification,
  subscribeStaffNotifications,
  unreadStaffNotificationCount,
  type StaffNotification,
} from "@/lib/staff-notifications";
import { useLiveOrders } from "@/hooks/useLiveOrders";
import { playKitchenChime, unlockKitchenAudio } from "@/lib/kitchen-chime";
import { readStaffNotificationSoundEnabled } from "@/lib/staff-notification-sound";
import { useBranch } from "@/modules/branches/BranchContext";
import type { StaffNotificationSeverity } from "@/lib/staff-notifications";

function playStaffNotifySound(severity: StaffNotificationSeverity) {
  if (!readStaffNotificationSoundEnabled()) return;
  void unlockKitchenAudio().then(() => playKitchenChime(severity === "info"));
}

function ingest(payload: StaffNotification) {
  pushStaffNotification({ ...payload, read: false });
}

export function useStaffNotificationsFeed() {
  const { selection } = useBranch();
  const branchFilter = selection === "all" ? "all" : selection;
  const [, tick] = useState(0);

  useEffect(() => subscribeStaffNotifications(() => tick((n) => n + 1)), []);

  const notifications = useMemo(() => {
    const all = getStaffNotifications();
    if (branchFilter === "all") return all;
    return all.filter((n) => !n.branchId || n.branchId === branchFilter);
  }, [branchFilter, tick]);

  const unread = useMemo(
    () => unreadStaffNotificationCount(branchFilter),
    [branchFilter, tick]
  );

  useLiveOrders(() => {}, undefined, undefined, {
    onOpsNotification: (payload) => {
      ingest({ ...payload, read: false } as StaffNotification);
      playStaffNotifySound(payload.severity as StaffNotificationSeverity);
    },
  });

  const markRead = useCallback((id: string) => markStaffNotificationRead(id), []);
  const markAllRead = useCallback(
    () => markAllStaffNotificationsRead(branchFilter),
    [branchFilter]
  );
  const clearAll = useCallback(() => clearStaffNotifications(), []);

  return { notifications, unread, markRead, markAllRead, clearAll };
}
