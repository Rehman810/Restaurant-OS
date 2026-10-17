export type Fulfillment = "DELIVERY" | "PICKUP" | "DINE_IN";

export type Status =
  | "PENDING_CONFIRMATION"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "COLLECTED"
  | "SERVED"
  | "CANCELLED";

const FLOWS: Record<Fulfillment, Status[]> = {
  DELIVERY: ["PENDING_CONFIRMATION", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"],
  PICKUP: ["PENDING_CONFIRMATION", "CONFIRMED", "PREPARING", "READY", "COLLECTED"],
  DINE_IN: ["PENDING_CONFIRMATION", "CONFIRMED", "PREPARING", "READY", "SERVED"],
};

const TERMINAL = new Set<Status>(["DELIVERED", "COLLECTED", "SERVED", "CANCELLED"]);

export function flowFor(fulfillment: Fulfillment = "DELIVERY") {
  return FLOWS[fulfillment] || FLOWS.DELIVERY;
}

export function isTerminalStatus(status: Status) {
  return TERMINAL.has(status);
}

export function canTransition(from: Status, to: Status, fulfillment: Fulfillment = "DELIVERY") {
  if (from === to) return true;
  if (isTerminalStatus(from)) return false;
  if (to === "CANCELLED") return true;
  const flow = flowFor(fulfillment);
  const fromIdx = flow.indexOf(from);
  const toIdx = flow.indexOf(to);
  if (fromIdx < 0 || toIdx < 0) return false;
  return toIdx === fromIdx + 1;
}

export function nextStatus(current: Status, fulfillment: Fulfillment = "DELIVERY"): Status | null {
  const flow = flowFor(fulfillment);
  const idx = flow.indexOf(current);
  if (idx < 0 || idx >= flow.length - 1) return null;
  return flow[idx + 1];
}

export function statusLabel(status: Status, fulfillment: Fulfillment = "DELIVERY") {
  if (status === "PENDING_CONFIRMATION") return "Awaiting confirmation";
  if (status === "CONFIRMED") return "Confirmed";
  if (status === "PREPARING") return "Preparing";
  if (status === "READY") {
    if (fulfillment === "DINE_IN") return "Ready to serve";
    if (fulfillment === "PICKUP") return "Ready for pickup";
    return "Ready for rider";
  }
  if (status === "OUT_FOR_DELIVERY") return "Out for delivery";
  if (status === "DELIVERED") return "Delivered";
  if (status === "COLLECTED") return "Collected";
  if (status === "SERVED") return "Served";
  return "Cancelled";
}
