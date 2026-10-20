import { FulfillmentType, OrderStatus } from "@prisma/client";
import {
  canTransition,
  flowFor,
  isKitchenUndoStep,
  isTerminalStatus,
  nextStatus,
  type Fulfillment,
  type Status,
} from "./order-machine";

function asStatus(status: OrderStatus): Status {
  return status as Status;
}

function asFulfillment(type?: FulfillmentType | null): Fulfillment {
  if (type === FulfillmentType.PICKUP) return "PICKUP";
  if (type === FulfillmentType.DINE_IN) return "DINE_IN";
  return "DELIVERY";
}

export function canTransitionStatus(
  from: OrderStatus,
  to: OrderStatus,
  fulfillment?: FulfillmentType | null
) {
  return canTransition(asStatus(from), asStatus(to), asFulfillment(fulfillment));
}

export function chefNextStatus(current: OrderStatus, fulfillment?: FulfillmentType | null): OrderStatus | null {
  const next = nextStatus(asStatus(current), asFulfillment(fulfillment));
  return (next as OrderStatus | null) ?? null;
}

export function chefKitchenUndoStatus(
  current: OrderStatus,
  target: OrderStatus,
  fulfillment?: FulfillmentType | null
): boolean {
  return isKitchenUndoStep(asStatus(current), asStatus(target), asFulfillment(fulfillment));
}

export function forwardStatusOptions(current: OrderStatus, fulfillment?: FulfillmentType | null): OrderStatus[] {
  if (isTerminalStatus(asStatus(current))) return [current];
  const flow = flowFor(asFulfillment(fulfillment));
  const idx = flow.indexOf(asStatus(current));
  const forward = (idx < 0 ? [] : flow.slice(idx)) as OrderStatus[];
  if (!forward.includes(OrderStatus.CANCELLED)) forward.push(OrderStatus.CANCELLED);
  return forward;
}
