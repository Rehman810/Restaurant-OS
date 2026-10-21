import { prisma } from "../prisma";

export type UserHistoryCounts = {
  ordersAsCustomer: number;
  ordersAsRider: number;
  ordersAsPos: number;
  ordersAsWaiter: number;
  cashShifts: number;
  cashMovements: number;
  riderCashEntries: number;
  auditAsActor: number;
  auditAsEntity: number;
};

export function historyTotal(c: UserHistoryCounts): number {
  return (
    c.ordersAsCustomer +
    c.ordersAsRider +
    c.ordersAsPos +
    c.ordersAsWaiter +
    c.cashShifts +
    c.cashMovements +
    c.riderCashEntries +
    c.auditAsActor +
    c.auditAsEntity
  );
}

export function hasStaffHistory(c: UserHistoryCounts): boolean {
  return historyTotal(c) > 0;
}

export async function fetchUserHistoryCounts(userId: string): Promise<UserHistoryCounts> {
  const [
    ordersAsCustomer,
    ordersAsRider,
    ordersAsPos,
    ordersAsWaiter,
    cashShifts,
    cashMovements,
    riderCashEntries,
    auditAsActor,
    auditAsEntity,
  ] = await Promise.all([
    prisma.order.count({ where: { customerId: userId } }),
    prisma.order.count({ where: { riderId: userId } }),
    prisma.order.count({ where: { createdById: userId } }),
    prisma.order.count({ where: { waiterId: userId } }),
    prisma.cashShift.count({ where: { cashierId: userId } }),
    prisma.cashMovement.count({ where: { createdById: userId } }),
    prisma.riderCashEntry.count({ where: { riderId: userId } }),
    prisma.auditLog.count({ where: { actorId: userId } }),
    prisma.auditLog.count({ where: { entityType: "user", entityId: userId } }),
  ]);
  return {
    ordersAsCustomer,
    ordersAsRider,
    ordersAsPos,
    ordersAsWaiter,
    cashShifts,
    cashMovements,
    riderCashEntries,
    auditAsActor,
    auditAsEntity,
  };
}
