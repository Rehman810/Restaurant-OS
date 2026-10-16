import {
  CashMovementType,
  FulfillmentType,
  PaymentMethod,
  Prisma,
  RiderCashEntryStatus,
} from "@prisma/client";
import { CashDb, recordCashMovement, requireOpenShift } from "./cash-shift";

const MONEY_EPS = 0.009;

export type CodOrderShape = {
  id: string;
  branchId: string | null;
  riderId: string | null;
  fulfillmentType: FulfillmentType;
  paymentMethod: PaymentMethod | null;
  total: Prisma.Decimal | { toString(): string };
};

export function isRiderCodOrder(order: Pick<CodOrderShape, "fulfillmentType" | "paymentMethod">) {
  if (order.fulfillmentType !== FulfillmentType.DELIVERY) return false;
  if (order.paymentMethod === PaymentMethod.CARD) return false;
  return true;
}

export function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

export type RiderCashDb = {
  riderCashEntry: {
    findUnique: (args: Prisma.RiderCashEntryFindUniqueArgs) => Promise<{ id: string; status: RiderCashEntryStatus } | null>;
    findMany: (args: Prisma.RiderCashEntryFindManyArgs) => Promise<
      {
        id: string;
        branchId: string;
        riderId: string;
        orderId: string;
        expectedAmount: Prisma.Decimal;
        collectedAmount: Prisma.Decimal;
        status: RiderCashEntryStatus;
      }[]
    >;
    create: (args: Prisma.RiderCashEntryCreateArgs) => Promise<{ id: string }>;
    updateMany: (args: Prisma.RiderCashEntryUpdateManyArgs) => Promise<{ count: number }>;
    deleteMany: (args: Prisma.RiderCashEntryDeleteManyArgs) => Promise<{ count: number }>;
  };
  order: {
    update: (args: Prisma.OrderUpdateArgs) => Promise<unknown>;
  };
  riderSettlement: {
    create: (args: Prisma.RiderSettlementCreateArgs) => Promise<{ id: string }>;
  };
};

export async function recordRiderCodOnDelivered(
  db: RiderCashDb,
  order: CodOrderShape,
  input?: { collectedAmount?: number; varianceReason?: string }
) {
  if (!isRiderCodOrder(order)) return null;
  if (!order.riderId || !order.branchId) return null;

  const existing = await db.riderCashEntry.findUnique({ where: { orderId: order.id } });
  if (existing) return { entry: existing, created: false };

  const expected = roundMoney(Number(order.total));
  const collected =
    input?.collectedAmount !== undefined ? roundMoney(input.collectedAmount) : expected;
  if (!Number.isFinite(collected) || collected < 0) {
    throw Object.assign(new Error("Collected amount must be zero or greater."), { status: 400 });
  }
  const varianceReason = input?.varianceReason?.trim() || "";
  if (Math.abs(collected - expected) > MONEY_EPS && !varianceReason) {
    throw Object.assign(new Error("A reason is required when collected cash differs from the order total."), {
      status: 400,
    });
  }

  await db.order.update({
    where: { id: order.id },
    data: {
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: "PAID",
    },
  });

  const entry = await db.riderCashEntry.create({
    data: {
      branchId: order.branchId,
      riderId: order.riderId,
      orderId: order.id,
      expectedAmount: expected,
      collectedAmount: collected,
      varianceReason: varianceReason || null,
      status: RiderCashEntryStatus.PENDING,
    },
  });
  return { entry, created: true };
}

export async function releaseRiderCashOnCancel(db: RiderCashDb, orderId: string) {
  await db.riderCashEntry.deleteMany({
    where: { orderId, status: RiderCashEntryStatus.PENDING },
  });
}

export async function settleRiderCashEntries(
  db: RiderCashDb,
  input: {
    branchId: string;
    riderId: string;
    entryIds: string[];
    receivedTotal: number;
    note?: string;
    settledById: string;
    shiftCashierId: string;
  }
) {
  const ids = [...new Set(input.entryIds)];
  if (!ids.length) {
    throw Object.assign(new Error("Select at least one pending entry to settle."), { status: 400 });
  }
  const received = roundMoney(input.receivedTotal);
  if (!Number.isFinite(received) || received < 0) {
    throw Object.assign(new Error("Received amount must be zero or greater."), { status: 400 });
  }

  const entries = await db.riderCashEntry.findMany({
    where: {
      id: { in: ids },
      riderId: input.riderId,
      branchId: input.branchId,
      status: RiderCashEntryStatus.PENDING,
    },
  });
  if (entries.length !== ids.length) {
    throw Object.assign(new Error("One or more entries are missing or already settled."), { status: 400 });
  }

  const expectedTotal = roundMoney(
    entries.reduce((sum, e) => sum + Number(e.collectedAmount), 0)
  );
  const variance = roundMoney(received - expectedTotal);
  const note = input.note?.trim() || "";

  const shift = await requireOpenShift(input.branchId, input.shiftCashierId);

  const settlement = await db.riderSettlement.create({
    data: {
      branchId: input.branchId,
      riderId: input.riderId,
      settledById: input.settledById,
      expectedTotal,
      receivedTotal: received,
      variance,
      note: note || null,
    },
  });

  const now = new Date();
  await db.riderCashEntry.updateMany({
    where: { id: { in: ids } },
    data: {
      status: RiderCashEntryStatus.SETTLED,
      settlementId: settlement.id,
      settledAt: now,
    },
  });

  if (received > 0) {
    const reason = note
      ? `Rider COD settlement (${entries.length} orders): ${note}`
      : `Rider COD settlement (${entries.length} orders)`;
    await recordCashMovement(db as unknown as CashDb, {
      shiftId: shift.id,
      type: CashMovementType.RIDER_SETTLEMENT,
      amount: received,
      reason,
      createdById: input.settledById,
    });
  }

  return { settlementId: settlement.id, expectedTotal, receivedTotal: received, variance };
}
