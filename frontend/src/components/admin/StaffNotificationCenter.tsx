"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Package, ShoppingBag, UtensilsCrossed, Warehouse, X } from "lucide-react";
import { useStaffNotificationsFeed } from "@/hooks/useStaffNotifications";
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

export function StaffNotificationCenter() {
  const { notifications, unread, markRead, markAllRead } = useStaffNotificationsFeed();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<StaffNotification | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

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
    function onDoc(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <>
      {toast && (
        <div
          className="fixed bottom-20 left-3 right-3 z-50 rounded-xl border border-stone-200 bg-white p-3 shadow-lg dark:border-stone-600 dark:bg-stone-900 sm:left-auto sm:right-6 sm:max-w-sm lg:bottom-6"
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
        </div>
      )}

      <div className="relative" ref={panelRef}>
        <button
          type="button"
          aria-label={unread ? `${unread} unread notifications` : "Notifications"}
          className="relative grid h-9 w-9 place-items-center rounded-xl border border-stone-200 bg-white text-stone-700 shadow-sm transition hover:border-brand-200 hover:text-brand-700 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200"
          onClick={() => setOpen((o) => !o)}
        >
          <Bell size={18} />
          {unread > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </button>

        {open && (
          <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl dark:border-stone-600 dark:bg-stone-900">
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
            <ul className="max-h-[min(24rem,60vh)] overflow-y-auto">
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
          </div>
        )}
      </div>
    </>
  );
}
