"use client";

export type StaffNotificationSeverity = "info" | "warning" | "urgent";

export type StaffNotificationKind =
  | "order_created"
  | "order_updated"
  | "inventory_low_stock"
  | "inventory_out_of_stock"
  | "inventory_restocked"
  | "menu_sold_out"
  | "menu_back_in_stock"
  | "kitchen_alert"
  | "reservation_pending";

export type StaffNotification = {
  id: string;
  kind: StaffNotificationKind;
  title: string;
  message: string;
  at: number;
  branchId?: string;
  href?: string;
  severity: StaffNotificationSeverity;
  read: boolean;
  meta?: Record<string, string | number | boolean | null>;
};

const STORAGE_KEY = "uff-staff-notifications-v1";
const MAX_ITEMS = 80;

type Listener = () => void;

let items: StaffNotification[] = [];
const listeners = new Set<Listener>();

function loadFromStorage() {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as StaffNotification[];
    if (Array.isArray(parsed)) items = parsed.slice(0, MAX_ITEMS);
  } catch {
    items = [];
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    /* ignore quota */
  }
}

function emitChange() {
  for (const l of listeners) l();
}

loadFromStorage();

export function subscribeStaffNotifications(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getStaffNotifications() {
  return items;
}

export function unreadStaffNotificationCount(branchId?: string | "all") {
  return items.filter((n) => {
    if (n.read) return false;
    if (!branchId || branchId === "all") return true;
    return !n.branchId || n.branchId === branchId;
  }).length;
}

export function pushStaffNotification(
  incoming: Omit<StaffNotification, "read"> & { read?: boolean }
) {
  const next: StaffNotification = {
    ...incoming,
    read: incoming.read ?? false,
  };
  if (items.some((n) => n.id === next.id)) return;
  items = [next, ...items].slice(0, MAX_ITEMS);
  persist();
  emitChange();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("staff-notification", { detail: next }));
  }
}

export function markStaffNotificationRead(id: string) {
  const idx = items.findIndex((n) => n.id === id);
  if (idx < 0 || items[idx].read) return;
  items = items.map((n) => (n.id === id ? { ...n, read: true } : n));
  persist();
  emitChange();
}

export function markAllStaffNotificationsRead(branchId?: string | "all") {
  items = items.map((n) => {
    if (n.read) return n;
    if (!branchId || branchId === "all") return { ...n, read: true };
    if (!n.branchId || n.branchId === branchId) return { ...n, read: true };
    return n;
  });
  persist();
  emitChange();
}

export function clearStaffNotifications() {
  items = [];
  persist();
  emitChange();
}
