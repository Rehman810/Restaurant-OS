"use client";

import { useEffect } from "react";
import { api } from "@/lib/api";
import { pushStaffNotification } from "@/lib/staff-notifications";
import { useBranch } from "@/modules/branches/BranchContext";

type Blockers = {
  dateKey: string;
  afterCutoff: boolean;
  openShifts: number;
};

/** Mount inside BranchProvider (uses branch selection for dedupe). */
export function DayCloseoutBlockerPoller({ enabled }: { enabled: boolean }) {
  useDayCloseoutBlockerNotification(enabled);
  return null;
}

/** Once per store day after close-out time, notify managers about open shifts. */
export function useDayCloseoutBlockerNotification(enabled: boolean) {
  const { selection } = useBranch();
  const branchId = selection === "all" ? undefined : selection;

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      void api<Blockers>("/admin/daily-summary/blockers")
        .then((b) => {
          if (!b.afterCutoff || b.openShifts <= 0) return;
          const id = `day-closeout-${b.dateKey}-${branchId ?? "all"}`;
          pushStaffNotification({
            id,
            kind: "day_closeout_blocker",
            title: "Day close-out blocked",
            message: `${b.openShifts} cash shift${b.openShifts === 1 ? "" : "s"} still open. Close shifts before the day can be final.`,
            at: Date.now(),
            branchId,
            href: "/admin/daily-summary",
            severity: "warning",
          });
        })
        .catch(() => {
          /* ignore polling errors */
        });
    };

    tick();
    const id = window.setInterval(tick, 30 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [enabled, branchId]);
}
