import { api } from "@/lib/api";
import type { Rider } from "@/lib/admin-types";
import type { FulfillmentType, OrderStatus } from "@/lib/types";
import type { AdminNextAction, AdminOrderRow } from "./types";
import type { BoardColumnId, SideColumnId } from "./board-columns";

export type TrackingRider = {
  id: string;
  name: string;
  status: "available" | "on_delivery";
  activeDeliveries: { id: string; shortDisplay: string; outSinceSeconds: number }[];
  activeDeliveryCount: number;
  longestOutSinceSeconds: number | null;
  codCashHeld: number;
  location: { locationAvailable: false; hidden?: boolean };
};

export type TrackingBoardCard = {
  id: string;
  number: string;
  shortNumber: string;
  shortDisplay: string;
  type: FulfillmentType;
  source: "online" | "pos";
  status: OrderStatus;
  outcome: "delivered" | "picked_up" | "served" | null;
  nextAction: {
    verb: string;
    targetStatus: OrderStatus;
    action: "transition" | "cancel";
  } | null;
  createdAt: string;
  statusChangedAt: string;
  ageSeconds: number;
  isLate: boolean;
  isStale: boolean;
  customer: { name: string; phone: string; phoneMasked?: boolean };
  itemsSummary: {
    lines: { quantity: number; name: string; optionsLabel: string }[];
    extraCount: number;
    hasNotes: boolean;
    hasAllergyHint: boolean;
  };
  table: string | null;
  address: { text: string; area: string | null; zoneWarning: boolean } | null;
  rider: {
    id: string;
    name: string;
    assignedAt: string | null;
    outSinceSeconds: number | null;
  } | null;
  needsRider?: boolean;
  total: number;
  payment: {
    status: string;
    methods: string[];
    codDue: number | null;
    label?: string;
  } | null;
  possibleDuplicateOf: string | null;
};

export type TrackingBoardColumn = {
  id: BoardColumnId | "PENDING_CONFIRMATION";
  label: string;
  count: number;
  value: number;
  cards: TrackingBoardCard[];
  historyLink?: string;
};

export type TrackingBoardResponse = {
  columns: TrackingBoardColumn[];
  cancelledToday: { count: number; cards: TrackingBoardCard[] };
  summary: {
    active: number;
    late: number;
    stale: number;
    unassignedDeliveries: number;
    pipelineValue: number;
    pipelineValueDefinition: string;
    bookedDefinition: string;
  };
  serverTime: string;
  timezone: string;
  timingMs?: number;
};

export type FetchTrackingBoardParams = {
  types?: FulfillmentType[];
  riderId?: string;
  lateOnly?: boolean;
  branchId?: string;
};

export function buildTrackingBoardQuery(params: FetchTrackingBoardParams) {
  const qs = new URLSearchParams();
  for (const t of params.types ?? []) qs.append("type[]", t);
  if (params.riderId) qs.set("riderId", params.riderId);
  if (params.lateOnly) qs.set("lateOnly", "true");
  if (params.branchId) qs.set("branchId", params.branchId);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export async function fetchTrackingBoard(params: FetchTrackingBoardParams = {}) {
  return api<TrackingBoardResponse>(`/admin/tracking/board${buildTrackingBoardQuery(params)}`);
}

export async function fetchTrackingSummary() {
  return api<{
    summary: TrackingBoardResponse["summary"];
    badge: number;
    serverTime: string;
    timezone: string;
  }>("/admin/tracking/summary");
}

export async function fetchTrackingRiders() {
  return api<{ riders: TrackingRider[]; serverTime: string }>("/admin/tracking/riders");
}

export function trackingRidersToPickerRiders(riders: TrackingRider[]): Rider[] {
  return riders.map((r) => ({
    id: r.id,
    name: r.name,
    activeDeliveries: r.activeDeliveryCount,
  }));
}

export function collectUnassignedDeliveries(columns: OrderBoardColumnView[]): AdminOrderRow[] {
  const out: AdminOrderRow[] = [];
  for (const col of columns) {
    for (const card of col.cards) {
      if (card.type === "DELIVERY" && card.needsRider) out.push(card);
    }
  }
  return out;
}

export function trackingCardToAdminRow(card: TrackingBoardCard): AdminOrderRow {
  const nextActions: AdminNextAction[] = card.nextAction
    ? [
        {
          action: card.nextAction.action,
          targetStatus: card.nextAction.targetStatus,
          label: card.nextAction.verb,
          primary: true,
        },
      ]
    : [];

  const payStatus = card.payment?.status;
  const payment =
    card.payment && payStatus
      ? {
          status: payStatus as "paid" | "partial" | "unpaid" | "cod",
          label: card.payment.label ?? payStatus,
          methods: card.payment.methods,
          amountDue: card.payment.codDue ?? 0,
          codAmount: card.payment.codDue,
        }
      : null;

  return {
    id: card.id,
    number: card.number,
    shortNumber: card.shortNumber,
    shortDisplay: card.shortDisplay,
    type: card.type,
    source: card.source,
    status: card.status,
    nextActions,
    createdAt: card.createdAt,
    statusChangedAt: card.statusChangedAt,
    ageSeconds: card.ageSeconds,
    isLate: card.isLate,
    isStale: card.isStale,
    customer: card.customer,
    itemsSummary: {
      lines: card.itemsSummary.lines,
      extraCount: card.itemsSummary.extraCount,
      totalItems: card.itemsSummary.lines.reduce((s, l) => s + l.quantity, 0) + card.itemsSummary.extraCount,
    },
    table: card.table,
    address: card.address
      ? { text: card.address.text, area: card.address.area }
      : null,
    rider: card.rider
      ? { id: card.rider.id, name: card.rider.name, assignedAt: card.rider.assignedAt }
      : null,
    totals: {
      subtotal: card.total,
      deliveryCharge: 0,
      taxAmount: 0,
      discountAmount: 0,
      total: card.total,
    },
    payment,
    possibleDuplicateOf: card.possibleDuplicateOf,
    print: { receiptPrinted: false, kotPrinted: false, kotPrintCount: 0 },
    notes: {
      hasNotes: card.itemsSummary.hasNotes,
      hasAllergyHint: card.itemsSummary.hasAllergyHint,
    },
    isRush: false,
    zoneWarning: card.address?.zoneWarning,
    needsRider: card.needsRider,
    outcome: card.outcome,
    riderOutSinceSeconds: card.rider?.outSinceSeconds ?? null,
  };
}

export type OrderBoardColumnView = {
  id: BoardColumnId | SideColumnId;
  label: string;
  count: number;
  value?: number;
  historyLink?: string;
  cards: AdminOrderRow[];
};

export function columnsFromTrackingResponse(res: TrackingBoardResponse): OrderBoardColumnView[] {
  return res.columns.map((col) => ({
    id: col.id as BoardColumnId | SideColumnId,
    label: col.label,
    count: col.count,
    value: col.value,
    historyLink: col.historyLink,
    cards: col.cards.map(trackingCardToAdminRow),
  }));
}

export function cancelledFromTracking(res: TrackingBoardResponse): AdminOrderRow[] {
  return res.cancelledToday.cards.map(trackingCardToAdminRow);
}
