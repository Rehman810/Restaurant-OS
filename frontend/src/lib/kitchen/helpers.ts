import { FulfillmentType, Order, OrderItem, OrderStatus } from "@/lib/types";
import type { PrintStation } from "@/lib/admin-print-stations";

export const KITCHEN_STATION_FILTER_KEY = "uff-kitchen-station-id";

/** Minutes waiting before timer turns amber (kitchen ticket header). */
export const KITCHEN_TIMER_AMBER_MINUTES = 10;
/** Minutes waiting before timer turns red. */
export const KITCHEN_TIMER_RED_MINUTES = 20;
/** Minutes in Ready lane before "getting cold" hint. */
export const KITCHEN_READY_COLD_MINUTES = 10;
/** Hours on board before stale badge. */
export const KITCHEN_STALE_HOURS = 2;

export function deriveShortOrderNumber(orderNumber: string): { short: string; display: string; full: string } {
  const full = orderNumber.trim();
  const segments = full.split(/[-/]/);
  const numeric = segments.filter((p) => /^\d+$/.test(p));
  const lastNum = numeric[numeric.length - 1];
  if (lastNum) {
    return { short: lastNum, display: `#${lastNum}`, full };
  }
  const tail = segments[segments.length - 1] || full;
  return { short: tail, display: tail.startsWith("#") ? tail : `#${tail}`, full };
}

/** Compact elapsed duration for KDS (no "ago", no calendar fallback). */
export function formatKitchenElapsed(iso: string, nowMs = Date.now()): string {
  const start = new Date(iso).getTime();
  if (!Number.isFinite(start)) return "—";
  const totalMins = Math.max(0, Math.floor((nowMs - start) / 60_000));
  if (totalMins < 1) return "<1m";
  if (totalMins < 60) return `${totalMins}m`;
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs < 48) return mins > 0 ? `${hrs}h ${String(mins).padStart(2, "0")}m` : `${hrs}h`;
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return remHrs > 0 ? `${days}d ${remHrs}h` : `${days}d`;
}

export type KitchenTimerTone = "normal" | "amber" | "red";

export function kitchenTimerTone(elapsedMinutes: number): KitchenTimerTone {
  if (elapsedMinutes >= KITCHEN_TIMER_RED_MINUTES) return "red";
  if (elapsedMinutes >= KITCHEN_TIMER_AMBER_MINUTES) return "amber";
  return "normal";
}

export function elapsedMinutes(iso: string, nowMs = Date.now()): number {
  const start = new Date(iso).getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((nowMs - start) / 60_000));
}

export function kitchenTimerClass(tone: KitchenTimerTone): string {
  if (tone === "red") return "text-red-600 dark:text-red-400";
  if (tone === "amber") return "text-amber-600 dark:text-amber-400";
  return "text-stone-600 dark:text-stone-300";
}

export function readyLaneActionLabel(fulfillment?: FulfillmentType | null): string {
  if (fulfillment === "DINE_IN") return "Served";
  if (fulfillment === "PICKUP") return "Picked up";
  return "Assign rider";
}

export function kitchenTicketTimerIso(order: Order): string {
  if (order.status === "READY" && order.readyAt) return order.readyAt;
  return order.createdAt;
}

export function sortKitchenLaneOrders(orders: Order[], lane: OrderStatus): Order[] {
  const list = [...orders];
  list.sort((a, b) => {
    const rushA = a.isRush ? 0 : 1;
    const rushB = b.isRush ? 0 : 1;
    if (rushA !== rushB) return rushA - rushB;
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    if (lane === "READY") {
      const ra = new Date(a.readyAt || a.createdAt).getTime();
      const rb = new Date(b.readyAt || b.createdAt).getTime();
      return ra - rb;
    }
    return ta - tb;
  });
  return list;
}

export function isKitchenOrderStale(order: Order, nowMs = Date.now()): boolean {
  const ageH = (nowMs - new Date(order.createdAt).getTime()) / 3_600_000;
  return ageH >= KITCHEN_STALE_HOURS;
}

export function formatPromisedTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit" });
}

export function isPromisedLate(promisedAt: string, nowMs = Date.now()): boolean {
  return nowMs > new Date(promisedAt).getTime();
}

export function formatKotPrintStatus(order: Pick<Order, "kotPrintedAt" | "kotPrintCount">): string {
  if (!order.kotPrintedAt) return "Not printed";
  const t = new Date(order.kotPrintedAt).toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit" });
  const reprint = (order.kotPrintCount ?? 0) > 1;
  return reprint ? `Reprinted ${t}` : `Printed ${t}`;
}

export type AllDayItemCount = { name: string; count: number };

export function buildAllDayItemCounts(orders: Order[]): AllDayItemCount[] {
  const map = new Map<string, number>();
  for (const order of orders) {
    if (order.status !== "CONFIRMED" && order.status !== "PREPARING") continue;
    for (const item of order.items) {
      const key = item.nameAtOrder.trim();
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + item.quantity);
    }
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function dineInTableLabel(order: Order): string | null {
  if (order.fulfillmentType !== "DINE_IN") return null;
  const fromRelation = order.diningTable?.label?.trim();
  if (fromRelation) return fromRelation;
  const num = order.tableNumber?.trim();
  if (num) return num.toLowerCase().startsWith("table") ? num : `Table ${num}`;
  return null;
}

export function defaultPrintStationId(stations: Pick<PrintStation, "id" | "isDefault">[]): string | null {
  if (!stations.length) return null;
  return stations.find((s) => s.isDefault)?.id ?? stations[0].id;
}

export function linePrintStationId(
  item: Pick<OrderItem, "printStationId" | "menuItem">,
  defaultStationId: string | null
): string | null {
  const id = item.printStationId ?? item.menuItem?.printStationId ?? null;
  return id ?? defaultStationId;
}

export function orderHasStationItems(
  order: Order,
  stationId: string | null,
  defaultStationId: string | null
): boolean {
  if (!stationId) return true;
  return order.items.some((item) => linePrintStationId(item, defaultStationId) === stationId);
}

export function filterOrderForStation(
  order: Order,
  stationId: string | null,
  defaultStationId: string | null
): Order {
  if (!stationId) return order;
  return {
    ...order,
    items: order.items.filter((item) => linePrintStationId(item, defaultStationId) === stationId),
  };
}

export function readKitchenStationFilter(): string | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(KITCHEN_STATION_FILTER_KEY);
  return v && v.length > 0 ? v : null;
}

export function writeKitchenStationFilter(stationId: string | null) {
  if (typeof window === "undefined") return;
  if (!stationId) localStorage.removeItem(KITCHEN_STATION_FILTER_KEY);
  else localStorage.setItem(KITCHEN_STATION_FILTER_KEY, stationId);
}

export function collectItemSafetyLines(item: {
  optionsLabel?: string;
  instructions?: string;
}): string[] {
  const lines: string[] = [];
  const opts = item.optionsLabel?.trim();
  const inst = item.instructions?.trim();
  if (opts) lines.push(opts);
  if (inst && inst !== opts) lines.push(inst);
  return lines.filter((l) => l.length > 0);
}
