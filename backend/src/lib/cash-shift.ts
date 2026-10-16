import { CashMovementType, CashShiftStatus, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { toMinorUnits } from "./money";

export const SHIFT_REQUIRED_CODE = "SHIFT_REQUIRED";
export const SHIFT_REQUIRED_ERROR = "Open a cash shift before taking cash payments.";

export type CashDb = Pick<typeof prisma, "cashShift" | "cashMovement">;

export type DenominationBreakdown = Record<string, number>;

const DENOM_KEYS = ["5000", "1000", "500", "100", "50", "20", "10", "coins"] as const;

export function sumDenominations(denoms: DenominationBreakdown) {
  let total = 0;
  const map: Record<string, number> = {
    "5000": 5000,
    "1000": 1000,
    "500": 500,
    "100": 100,
    "50": 50,
    "20": 20,
    "10": 10,
    coins: 1,
  };
  for (const key of DENOM_KEYS) {
    const count = Number(denoms[key] ?? 0);
    if (!Number.isFinite(count) || count < 0) continue;
    total += count * map[key];
  }
  return total;
}

export function movementDelta(type: CashMovementType, amount: number) {
  const minor = toMinorUnits(amount);
  switch (type) {
    case CashMovementType.SALE_CASH:
    case CashMovementType.PAID_IN:
    case CashMovementType.RIDER_SETTLEMENT:
      return minor;
    case CashMovementType.REFUND_CASH:
    case CashMovementType.PAID_OUT:
      return -minor;
    case CashMovementType.ADJUSTMENT:
      return minor;
    default:
      return 0;
  }
}

export function computeExpectedCashMinor(
  openingCash: number | string,
  movements: { type: CashMovementType; amount: { toString(): string } }[]
) {
  let minor = toMinorUnits(openingCash);
  for (const m of movements) {
    minor += movementDelta(m.type, Number(m.amount));
  }
  return minor;
}

export async function findOpenShift(branchId: string, cashierId: string) {
  return prisma.cashShift.findFirst({
    where: { branchId, cashierId, status: CashShiftStatus.OPEN },
    include: { movements: { orderBy: { createdAt: "asc" } } },
  });
}

export async function requireOpenShift(branchId: string, cashierId: string) {
  const shift = await findOpenShift(branchId, cashierId);
  if (!shift) {
    const err = Object.assign(new Error(SHIFT_REQUIRED_ERROR), {
      status: 403,
      code: SHIFT_REQUIRED_CODE,
    });
    throw err;
  }
  return shift;
}

export async function recordCashMovement(
  db: CashDb,
  input: {
    shiftId: string;
    type: CashMovementType;
    amount: number;
    reason: string;
    orderId?: string | null;
    createdById?: string | null;
    allowClosed?: boolean;
  }
) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw Object.assign(new Error("Amount must be greater than zero."), { status: 400 });
  }
  const reason = input.reason.trim();
  if (!reason) {
    throw Object.assign(new Error("A reason is required."), { status: 400 });
  }
  const shift = await db.cashShift.findUnique({ where: { id: input.shiftId } });
  if (!shift) {
    throw Object.assign(new Error("Shift not found."), { status: 404 });
  }
  if (!input.allowClosed && shift.status !== CashShiftStatus.OPEN) {
    throw Object.assign(new Error("Shift is not open."), { status: 400 });
  }
  if (input.allowClosed && shift.status !== CashShiftStatus.CLOSED) {
    throw Object.assign(new Error("Shift must be closed for this adjustment."), { status: 400 });
  }
  return db.cashMovement.create({
    data: {
      shiftId: input.shiftId,
      type: input.type,
      amount: input.amount,
      reason,
      orderId: input.orderId ?? null,
      createdById: input.createdById ?? null,
    },
  });
}

export function buildShiftReport(
  shift: {
    openingCash: { toString(): string };
    movements: { type: CashMovementType; amount: { toString(): string } }[];
  },
  closingCountedCash?: number | null
) {
  const expectedMinor = computeExpectedCashMinor(Number(shift.openingCash), shift.movements);
  const expectedCash = expectedMinor / 100;
  const counted = closingCountedCash ?? null;
  const variance = counted != null ? counted - expectedCash : null;
  const byType: Record<string, number> = {};
  for (const m of shift.movements) {
    const key = m.type;
    byType[key] = (byType[key] ?? 0) + Number(m.amount);
  }
  return { expectedCash, counted, variance, byType };
}

export async function openCashShift(
  branchId: string,
  cashierId: string,
  openingCash: number
) {
  if (!Number.isFinite(openingCash) || openingCash < 0) {
    throw Object.assign(new Error("Opening cash must be zero or greater."), { status: 400 });
  }
  return prisma.$transaction(async (tx) => {
    const existing = await tx.cashShift.findFirst({
      where: { branchId, cashierId, status: CashShiftStatus.OPEN },
    });
    if (existing) {
      throw Object.assign(new Error("You already have an open shift."), { status: 409 });
    }
    return tx.cashShift.create({
      data: {
        branchId,
        cashierId,
        openingCash,
        status: CashShiftStatus.OPEN,
      },
      include: { movements: true },
    });
  });
}

export async function closeCashShift(
  shiftId: string,
  input: {
    countedCash: number;
    denominations?: DenominationBreakdown | null;
    note?: string | null;
    managerNote?: string | null;
    varianceTolerance: number;
  }
) {
  if (!Number.isFinite(input.countedCash) || input.countedCash < 0) {
    throw Object.assign(new Error("Counted cash must be zero or greater."), { status: 400 });
  }
  if (input.denominations) {
    const fromDenoms = sumDenominations(input.denominations);
    if (Math.abs(fromDenoms - input.countedCash) > 0.02) {
      throw Object.assign(new Error("Counted cash does not match denomination total."), { status: 400 });
    }
  }

  return prisma.$transaction(async (tx) => {
    const shift = await tx.cashShift.findUnique({
      where: { id: shiftId },
      include: { movements: true },
    });
    if (!shift || shift.status !== CashShiftStatus.OPEN) {
      throw Object.assign(new Error("Shift is not open."), { status: 400 });
    }
    const report = buildShiftReport(shift, input.countedCash);
    const variance = report.variance ?? 0;
    if (Math.abs(variance) > input.varianceTolerance && !input.managerNote?.trim()) {
      throw Object.assign(
        new Error("Variance exceeds tolerance. A manager note is required."),
        { status: 400, code: "VARIANCE_NOTE_REQUIRED" }
      );
    }
    return tx.cashShift.update({
      where: { id: shiftId },
      data: {
        status: CashShiftStatus.CLOSED,
        closedAt: new Date(),
        closingCountedCash: input.countedCash,
        closingDenominations: input.denominations ?? Prisma.JsonNull,
        expectedCash: report.expectedCash,
        variance,
        note: input.note?.trim() || null,
        closingManagerNote: input.managerNote?.trim() || null,
      },
      include: { movements: { orderBy: { createdAt: "asc" } }, cashier: { select: { id: true, name: true } } },
    });
  });
}
