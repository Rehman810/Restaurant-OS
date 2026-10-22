"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Megaphone, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { pushStaffNotification } from "@/lib/staff-notifications";
import {
  PLATFORM_MAINTENANCE_EVENT,
  type PlatformMaintenanceDetail,
} from "@/lib/platform-maintenance-event";

type Announcement = {
  id: string;
  title: string;
  body: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  dismissible: boolean;
};

type CommsPayload = {
  announcements: Announcement[];
  maintenance: { active: boolean; message: string };
};

const SYNC_KEY = "uff-platform-comms-sync-v1";

const tone: Record<Announcement["severity"], string> = {
  INFO: "border-sky-500/35 bg-gradient-to-r from-sky-500/12 to-sky-500/5 text-sky-950 shadow-sm shadow-sky-500/10 dark:text-sky-50",
  WARNING: "border-amber-500/35 bg-gradient-to-r from-amber-500/12 to-amber-500/5 text-amber-950 shadow-sm shadow-amber-500/10 dark:text-amber-50",
  CRITICAL: "border-rose-500/40 bg-gradient-to-r from-rose-500/15 to-rose-500/5 text-rose-950 shadow-sm shadow-rose-500/10 dark:text-rose-50",
};

function readSynced(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(SYNC_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeSynced(ids: Set<string>) {
  sessionStorage.setItem(SYNC_KEY, JSON.stringify([...ids].slice(-40)));
}

function severityToStaff(severity: Announcement["severity"]) {
  if (severity === "CRITICAL") return "urgent" as const;
  if (severity === "WARNING") return "warning" as const;
  return "info" as const;
}

export function PlatformCommsLayer() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [maintenance, setMaintenance] = useState<{ active: boolean; message: string } | null>(null);

  function reload() {
    void api<CommsPayload>("/admin/announcements")
      .then((res) => {
        setAnnouncements(res.announcements ?? []);
        setMaintenance(res.maintenance ?? { active: false, message: "" });
      })
      .catch(() => {
        setAnnouncements([]);
      });
  }

  useEffect(() => {
    reload();
    const onMaintenance = (e: Event) => {
      const detail = (e as CustomEvent<PlatformMaintenanceDetail>).detail;
      if (detail?.active) {
        setMaintenance({ active: true, message: detail.message });
      }
    };
    window.addEventListener(PLATFORM_MAINTENANCE_EVENT, onMaintenance);
    return () => window.removeEventListener(PLATFORM_MAINTENANCE_EVENT, onMaintenance);
  }, []);

  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (reason instanceof ApiError && reason.code === "MAINTENANCE") {
        event.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  useEffect(() => {
    if (!announcements.length && !maintenance?.active) return;
    const synced = readSynced();
    for (const item of announcements) {
      const key = `ann:${item.id}`;
      if (synced.has(key)) continue;
      pushStaffNotification({
        id: key,
        kind: "platform_announcement",
        title: item.title,
        message: item.body || item.title,
        at: Date.now(),
        severity: severityToStaff(item.severity),
        href: "/admin",
        read: false,
        meta: { announcementId: item.id },
      });
      synced.add(key);
    }
    if (maintenance?.active) {
      const key = "maintenance:active";
      if (!synced.has(key)) {
        pushStaffNotification({
          id: key,
          kind: "platform_maintenance",
          title: "Platform maintenance",
          message: maintenance.message,
          at: Date.now(),
          severity: "warning",
          href: "/admin",
          read: false,
        });
        synced.add(key);
      }
    }
    writeSynced(synced);
  }, [announcements, maintenance]);

  if (!maintenance?.active && announcements.length === 0) return null;

  return (
    <div className="mb-5 space-y-2.5 px-3 pt-3 sm:px-5 lg:px-6">
      {maintenance?.active ? (
        <div
          className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent px-4 py-3.5 text-sm text-amber-950 shadow-sm dark:text-amber-50"
          role="alert"
        >
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Platform maintenance</p>
            <p className="mt-0.5 leading-relaxed opacity-90">{maintenance.message}</p>
            <p className="mt-1.5 text-xs opacity-75">Saving changes may fail until maintenance ends. You can still browse.</p>
          </div>
        </div>
      ) : null}
      {announcements.map((item) => (
        <div
          key={item.id}
          className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm ${tone[item.severity]}`}
          role="status"
        >
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/40 dark:bg-white/10">
            <Megaphone className="h-4 w-4 opacity-80" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{item.title}</p>
            {item.body ? <p className="mt-1 leading-relaxed opacity-90">{item.body}</p> : null}
            <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide opacity-60">From Restaurant OS</p>
          </div>
          {item.dismissible ? (
            <button
              type="button"
              className="rounded-lg p-1.5 opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
              aria-label="Dismiss broadcast"
              onClick={() => {
                void api(`/admin/announcements/${item.id}/dismiss`, { method: "POST" })
                  .then(() => setAnnouncements((prev) => prev.filter((a) => a.id !== item.id)))
                  .catch((err) => {
                    if (err instanceof ApiError && err.code === "MAINTENANCE") return;
                  });
              }}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
