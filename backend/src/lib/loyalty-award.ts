import { FulfillmentType, OrderStatus, Role } from "@prisma/client";
import { getStoreSettings } from "./settings-data";
import { pointsEarnedForTotal } from "./loyalty";

const EARN_STATUSES: OrderStatus[] = [
  OrderStatus.DELIVERED,
  OrderStatus.COLLECTED,
  OrderStatus.SERVED,
];

export async function maybeAwardLoyalty(
  db: {
    order: {
      findUnique: (args: { where: { id: string } }) => Promise<{
        id: string;
        customerId: string | null;
        status: OrderStatus;
        total: { toString(): string };
        loyaltyPointsEarned: number;
      } | null>;
      update: (args: { where: { id: string }; data: { loyaltyPointsEarned: number } }) => Promise<unknown>;
    };
    user: {
      update: (args: {
        where: { id: string };
        data: { loyaltyPoints: { increment: number } };
      }) => Promise<unknown>;
    };
  },
  orderId: string
) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order?.customerId) return;
  if (!EARN_STATUSES.includes(order.status)) return;
  if (order.loyaltyPointsEarned > 0) return;

  const settings = await getStoreSettings();
  const points = pointsEarnedForTotal(Number(order.total), settings);
  if (points <= 0) return;

  await db.user.update({
    where: { id: order.customerId },
    data: { loyaltyPoints: { increment: points } },
  });
  await db.order.update({
    where: { id: orderId },
    data: { loyaltyPointsEarned: points },
  });
}

export function customerCanEarn(role: Role | undefined) {
  return !role || role === Role.CUSTOMER;
}
