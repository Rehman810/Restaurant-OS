"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  CheckCheck,
  Megaphone,
  Package,
  ShoppingBag,
  UtensilsCrossed,
  Volume2,
  VolumeX,
  Warehouse,
  Wrench,
  X,
} from "lucide-react";
import { useStaffNotificationsFeed } from "@/hooks/useStaffNotifications";
import { unlockKitchenAudio, playKitchenChime } from "@/lib/kitchen-chime";
import {
  readStaffNotificationSoundEnabled,
  writeStaffNotificationSoundEnabled,
} from "@/lib/staff-notification-sound";
import {
  readStaffPushEnabled,
  subscribeToStaffPush,
  unsubscribeFromStaffPush,
  writeStaffPushEnabled,
} from "@/lib/staff-push-subscribe";
import type { StaffNotification, StaffNotificationKind } from "@/lib/staff-notifications";

function kindIcon(kind: StaffNotificationKind) {
  switch (kind) {
    case "order_created":
    case "order_updated":
      return ShoppingBag;
    case "inventory_low_stock":
    case "inventory_out_of_stock":
    case "inventory_restocked":
      return Warehouse;
    case "menu_sold_out":
    case "menu_back_in_stock":
      return UtensilsCrossed;
    case "reservation_pending":
      return Package;
    case "platform_announcement":
      return Megaphone;
    case "platform_maintenance":
      return Wrench;
    default:
      return Bell;
  }
}

function severityTone(severity: StaffNotification["severity"]) {
  if (severity === "urgent") return "border-l-red-500 bg-red-50/80 dark:bg-red-950/30";
  if (severity === "warning") return "border-l-amber-500 bg-amber-50/80 dark:bg-amber-950/30";
  return "border-l-stone-300 bg-white dark:border-l-stone-600 dark:bg-stone-900";
}

function formatWhen(at: number) {
  const d = new Date(at);
  const now = Date.now();
  const diff = now - at;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

type PanelPos = { top: number; right: number; width: number };

export function StaffNotificationCenter() {
  const { notifications, unread, markRead, markAllRead } = useStaffNotificationsFeed();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<StaffNotification | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [panelPos, setPanelPos] = useState<PanelPos | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushHint, setPushHint] = useState("");

  useEffect(() => {
    setSoundOn(readStaffNotificationSoundEnabled());
    setPushOn(readStaffPushEnabled() && typeof Notification !== "undefined" && Notification.permission === "granted");
  }, []);

  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (!readStaffPushEnabled()) return;
    void subscribeToStaffPush()
      .then(() => setPushOn(true))
      .catch(() => {
        writeStaffPushEnabled(false);
        setPushOn(false);
      });
  }, []);

  const updatePanelPos = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const width = Math.min(352, window.innerWidth - 16);
    setPanelPos({
      top: rect.bottom + 8,
      right: Math.max(8, window.innerWidth - rect.right),
      width,
    });
  }, []);

  useEffect(() => {
    let dismissId: number | null = null;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<StaffNotification>).detail;
      if (!detail) return;
      setToast(detail);
      if (dismissId) window.clearTimeout(dismissId);
      dismissId = window.setTimeout(() => setToast(null), 12_000);
    };
    window.addEventListener("staff-notification", handler);
    return () => {
      window.removeEventListener("staff-notification", handler);
      if (dismissId) window.clearTimeout(dismissId);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePanelPos();
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if ((target as Element).closest?.("[data-staff-notification-panel]")) return;
      setOpen(false);
    }
    function onLayout() {
      updatePanelPos();
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("resize", onLayout);
    window.addEventListener("scroll", onLayout, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("resize", onLayout);
      window.removeEventListener("scroll", onLayout, true);
    };
  }, [open, updatePanelPos]);

  return (
    <>
      {toast &&
        createPortal(
        <div
          className="fixed left-3 right-3 z-[100] max-w-sm rounded-xl border border-stone-200 bg-white p-3 shadow-lg dark:border-stone-600 dark:bg-stone-900 sm:left-auto sm:right-6"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 4.25rem)" }}
          role="status"
        >
          <div className="flex gap-2">
            <Bell size={18} className="mt-0.5 shrink-0 text-brand-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{toast.title}</p>
              <p className="mt-0.5 text-xs text-stone-600 dark:text-stone-400">{toast.message}</p>
              {toast.href ? (
                <Link
                  href={toast.href}
                  className="mt-2 inline-block text-xs font-bold text-brand-700 dark:text-brand-400"
                  onClick={() => {
                    markRead(toast.id);
                    setToast(null);
                  }}
                >
                  Open
                </Link>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              className="shrink-0 rounded-lg p-1 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
              onClick={() => setToast(null)}
            >
              <X size={16} />
            </button>
          </div>
        </div>,
        document.body
      )}

      <div className="relative overflow-visible" ref={rootRef}>
        <button
          ref={buttonRef}
          type="button"
          aria-label={unread ? `${unread} unread notifications` : "Notifications"}
          aria-expanded={open}
          className="relative grid h-9 w-9 place-items-center overflow-visible rounded-xl border border-stone-200 bg-white text-stone-700 shadow-sm transition hover:border-brand-200 hover:text-brand-700 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200"
          onClick={() => {
            void unlockKitchenAudio();
            setOpen((o) => {
              const next = !o;
              if (next) requestAnimationFrame(() => updatePanelPos());
              return next;
            });
          }}
        >
          <Bell size={18} />
          {unread > 0 ? (
            <span className="absolute right-0 top-0 flex h-4 min-w-4 translate-x-1/3 -translate-y-1/3 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-[#fffaf5] dark:ring-stone-950">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </button>

        {open &&
          panelPos &&
          createPortal(
            <div
              data-staff-notification-panel
              className="fixed z-[100] overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl dark:border-stone-600 dark:bg-stone-900"
              style={{
                top: panelPos.top,
                right: panelPos.right,
                width: panelPos.width,
                maxHeight: `min(24rem, calc(100vh - ${panelPos.top}px - 1rem))`,
              }}
            >
              <div className="flex items-center justify-between border-b border-stone-100 px-3 py-2 dark:border-stone-700">
                <p className="text-sm font-bold text-stone-900 dark:text-stone-100">Notifications</p>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs font-semibold text-brand-700 dark:text-brand-400"
                  onClick={() => markAllRead()}
                >
                  <CheckCheck size={14} /> Mark all read
                </button>
              </div>
              <div className="space-y-2 border-b border-stone-100 px-3 py-2.5 dark:border-stone-700">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-stone-600 dark:text-stone-400">Alert sound</span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-xs font-semibold text-stone-700 dark:border-stone-600 dark:text-stone-200"
                    onClick={() => {
                      const next = !soundOn;
                      writeStaffNotificationSoundEnabled(next);
                      setSoundOn(next);
                      if (next) void unlockKitchenAudio().then(() => playKitchenChime(true));
                    }}
                  >
                    {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
                    {soundOn ? "On" : "Off"}
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-stone-600 dark:text-stone-400">Browser push</span>
                  <button
                    type="button"
                    disabled={pushBusy}
                    className="rounded-lg border border-stone-200 px-2 py-1 text-xs font-semibold text-brand-700 disabled:opacity-60 dark:border-stone-600 dark:text-brand-400"
                    onClick={() => {
                      setPushHint("");
                      setPushBusy(true);
                      void (pushOn ? unsubscribeFromStaffPush() : subscribeToStaffPush())
                        .then(() => {
                          setPushOn(!pushOn);
                          if (!pushOn) setPushHint("Push enabled for this device.");
                        })
                        .catch((err) => {
                          setPushHint(err instanceof Error ? err.message : "Could not enable push.");
                        })
                        .finally(() => setPushBusy(false));
                    }}
                  >
                    {pushBusy ? "…" : pushOn ? "On" : "Enable"}
                  </button>
                </div>
                {pushHint ? <p className="text-[11px] text-stone-500">{pushHint}</p> : null}
              </div>
              <ul className="overflow-y-auto" style={{ maxHeight: `min(20rem, calc(100vh - ${panelPos.top}px - 8rem))` }}>
                {notifications.length === 0 ? (
                  <li className="px-4 py-8 text-center text-sm text-stone-500">No notifications yet.</li>
                ) : (
                  notifications.map((n) => {
                    const Icon = kindIcon(n.kind);
                    const inner = (
                      <div
                        className={`border-l-4 px-3 py-2.5 ${severityTone(n.severity)} ${
                          n.read ? "opacity-70" : ""
                        }`}
                      >
                        <div className="flex gap-2">
                          <Icon size={16} className="mt-0.5 shrink-0 text-stone-500" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{n.title}</p>
                            <p className="text-xs text-stone-600 dark:text-stone-400">{n.message}</p>
                            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-stone-400">
                              {formatWhen(n.at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                    return (
                      <li key={n.id} className="border-b border-stone-100 last:border-0 dark:border-stone-800">
                        {n.href ? (
                          <Link
                            href={n.href}
                            className="block hover:bg-stone-50 dark:hover:bg-stone-800/50"
                            onClick={() => {
                              markRead(n.id);
                              setOpen(false);
                            }}
                          >
                            {inner}
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className="block w-full text-left hover:bg-stone-50 dark:hover:bg-stone-800/50"
                            onClick={() => markRead(n.id)}
                          >
                            {inner}
                          </button>
                        )}
                      </li>
                    );
                  })
                )}
              </ul>
            </div>,
            document.body
          )}
      </div>
    </>
  );
}
