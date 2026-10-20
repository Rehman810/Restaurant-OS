import { FulfillmentType, OrderStatus, Role } from "@prisma/client";
import { canTransitionStatus, chefNextStatus } from "../order-status";
import { terminalLabel } from "../order-machine";
import type { Fulfillment } from "../order-machine";

function asFulfillment(type: FulfillmentType): Fulfillment {
  if (type === FulfillmentType.PICKUP) return "PICKUP";
  if (type === FulfillmentType.DINE_IN) return "DINE_IN";
  return "DELIVERY";
}

function stepLabel(target: OrderStatus, fulfillment: FulfillmentType): string {
  if (target === OrderStatus.CONFIRMED) return "Confirm order";
  if (target === OrderStatus.PREPARING) return "Mark preparing";
  if (target === OrderStatus.READY) return "Mark ready";
  if (target === OrderStatus.OUT_FOR_DELIVERY) return "Out for delivery";
  if (target === OrderStatus.DELIVERED) return "Mark completed";
  if (target === OrderStatus.COLLECTED) return "Mark completed";
  if (target === OrderStatus.SERVED) return "Mark completed";
  if (target === OrderStatus.CANCELLED) return "Cancel order";
  return target;
}

export type NextAction = {
  action: "transition" | "cancel";
  targetStatus: OrderStatus;
  label: string;
  primary: boolean;
};

export function nextActionsForRole(
  role: Role,
  status: OrderStatus,
  fulfillmentType: FulfillmentType
): NextAction[] {
  const actions: NextAction[] = [];
  const fulfillment = asFulfillment(fulfillmentType);

  if (role === Role.CHEF) {
    const next = chefNextStatus(status, fulfillmentType);
    if (next && next !== status) {
      actions.push({
        action: "transition",
        targetStatus: next,
        label: stepLabel(next, fulfillmentType),
        primary: true,
      });
    }
    return actions;
  }

  if (role === Role.RIDER) {
    return actions;
  }

  const staffRoles: Role[] = [Role.ADMIN, Role.MANAGER, Role.CASHIER, Role.WAITER];
  if (!staffRoles.includes(role)) return actions;

  let next: OrderStatus | null = null;
  const candidates: OrderStatus[] = [
    OrderStatus.CONFIRMED,
    OrderStatus.PREPARING,
    OrderStatus.READY,
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.DELIVERED,
    OrderStatus.COLLECTED,
    OrderStatus.SERVED,
  ];
  for (const c of candidates) {
    if (c === status) continue;
    if (canTransitionStatus(status, c, fulfillmentType)) {
      next = c;
      break;
    }
  }

  if (next) {
    let label = stepLabel(next, fulfillmentType);
    if (
      next === OrderStatus.DELIVERED ||
      next === OrderStatus.COLLECTED ||
      next === OrderStatus.SERVED
    ) {
      label = `Mark completed (${terminalLabel(fulfillment)})`;
    }
    actions.push({
      action: "transition",
      targetStatus: next,
      label,
      primary: true,
    });
  }

  if (
    status !== OrderStatus.CANCELLED &&
    canTransitionStatus(status, OrderStatus.CANCELLED, fulfillmentType) &&
    (role === Role.ADMIN || role === Role.MANAGER || role === Role.CASHIER)
  ) {
    actions.push({
      action: "cancel",
      targetStatus: OrderStatus.CANCELLED,
      label: "Cancel order",
      primary: false,
    });
  }

  return actions;
}
