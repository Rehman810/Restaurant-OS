import {
  CashShiftStatus,
  OrderStatus,
  ReservationStatus,
  RiderCashEntryStatus,
  TableStatus,
  WaitlistStatus,
} from "@prisma/client";
import { prisma } from "../prisma";
import { PIPELINE_STATUSES } from "../dashboard/order-completion";
import { getStoreSettings } from "../settings-data";

export type DeactivationBlocker = {
  code: string;
  label: string;
  count: number;
  href: string;
};

export type DeactivationCheckResult = {
  canDeactivate: boolean;
  blockers: DeactivationBlocker[];
  staffAssigned: number;
  staffNote: string;
};

const RESERVATION_BLOCK = [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] as ReservationStatus[];
const WAITLIST_BLOCK = [WaitlistStatus.WAITING, WaitlistStatus.CALLED] as WaitlistStatus[];

export async function countActiveBranches(excludeId?: string): Promise<number> {
  return prisma.branch.count({
    where: { isActive: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
}

export async function buildDeactivationCheck(branchId: string): Promise<DeactivationCheckResult> {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true, isDefault: true, isActive: true },
  });
  if (!branch) {
    return {
      canDeactivate: false,
      blockers: [{ code: "NOT_FOUND", label: "Branch not found", count: 0, href: "/admin/branches" }],
      staffAssigned: 0,
      staffNote: "",
    };
  }

  const blockers: DeactivationBlocker[] = [];

  if (branch.isDefault) {
    blockers.push({
      code: "DEFAULT_BRANCH",
      label: "This is the default branch. Choose another default first.",
      count: 1,
      href: "/admin/branches",
    });
  }

  const otherActive = await countActiveBranches(branchId);
  if (branch.isActive && otherActive === 0) {
    blockers.push({
      code: "LAST_ACTIVE_BRANCH",
      label: "At least one branch must stay active.",
      count: 1,
      href: "/admin/branches",
    });
  }

  const settings = await getStoreSettings();
  const q = branchId;

  const [
    openOrders,
    openShifts,
    pendingBookings,
    seatedTables,
    activeWaitlist,
    riderCashOpen,
    syncReview,
    staffAssigned,
  ] = await Promise.all([
    prisma.order.count({ where: { branchId: q, status: { in: PIPELINE_STATUSES } } }),
    prisma.cashShift.count({ where: { branchId: q, status: CashShiftStatus.OPEN } }),
    prisma.reservation.count({
      where: { branchId: q, status: { in: RESERVATION_BLOCK }, startsAt: { gte: new Date() } },
    }),
    prisma.diningTable.count({
      where: { branchId: q, status: { in: [TableStatus.OCCUPIED, TableStatus.RESERVED] } },
    }),
    prisma.waitlistEntry.count({ where: { branchId: q, status: { in: WAITLIST_BLOCK } } }),
    prisma.riderCashEntry.count({
      where: { branchId: q, status: RiderCashEntryStatus.PENDING },
    }),
    settings.offlinePosEnabled
      ? prisma.order.count({ where: { branchId: q, needsReview: true } })
      : Promise.resolve(0),
    prisma.branchMember.count({ where: { branchId: q } }),
  ]);

  if (openOrders > 0) {
    blockers.push({
      code: "OPEN_ORDERS",
      label: "Orders still in progress",
      count: openOrders,
      href: `/admin/orders?branchId=${q}`,
    });
  }
  if (openShifts > 0) {
    blockers.push({
      code: "OPEN_SHIFTS",
      label: "Open cash shifts",
      count: openShifts,
      href: `/admin/shifts?branchId=${q}`,
    });
  }
  if (pendingBookings > 0) {
    blockers.push({
      code: "PENDING_BOOKINGS",
      label: "Upcoming bookings",
      count: pendingBookings,
      href: `/admin/dine-in?branchId=${q}`,
    });
  }
  if (seatedTables > 0) {
    blockers.push({
      code: "SEATED_TABLES",
      label: "Tables in use",
      count: seatedTables,
      href: `/admin/dine-in?branchId=${q}`,
    });
  }
  if (activeWaitlist > 0) {
    blockers.push({
      code: "ACTIVE_WAITLIST",
      label: "Guests on the waitlist",
      count: activeWaitlist,
      href: `/admin/dine-in?branchId=${q}`,
    });
  }
  if (riderCashOpen > 0) {
    blockers.push({
      code: "RIDER_CASH",
      label: "Unsettled rider cash",
      count: riderCashOpen,
      href: `/admin/riders/cash?branchId=${q}`,
    });
  }
  if (syncReview > 0) {
    blockers.push({
      code: "SYNC_CONFLICTS",
      label: "Orders needing sync review",
      count: syncReview,
      href: `/admin/sync-conflicts?branchId=${q}`,
    });
  }

  const staffNote =
    "Staff who only belong to this branch will lose admin access to it when deactivated. Reassign them to another branch, or confirm removal.";

  return {
    canDeactivate: blockers.length === 0,
    blockers,
    staffAssigned,
    staffNote,
  };
}

export type StaffDeactivationAction =
  | { mode: "reassign"; targetBranchId: string }
  | { mode: "revoke" };

export async function applyStaffOnDeactivation(
  branchId: string,
  action: StaffDeactivationAction
): Promise<{ reassigned: number; revoked: number }> {
  const members = await prisma.branchMember.findMany({
    where: { branchId },
    select: { userId: true },
  });
  if (!members.length) return { reassigned: 0, revoked: 0 };

  if (action.mode === "reassign") {
    const target = await prisma.branch.findFirst({
      where: { id: action.targetBranchId, isActive: true },
      select: { id: true },
    });
    if (!target) {
      throw Object.assign(new Error("Target branch is not available."), { status: 400 });
    }
    let reassigned = 0;
    for (const { userId } of members) {
      const other = await prisma.branchMember.findMany({ where: { userId }, select: { branchId: true } });
      const branchIds = other.map((m) => m.branchId).filter((id) => id !== branchId);
      if (!branchIds.includes(target.id)) branchIds.push(target.id);
      await prisma.branchMember.deleteMany({ where: { userId, branchId } });
      await prisma.branchMember.createMany({
        data: branchIds.map((id) => ({ userId, branchId: id })),
        skipDuplicates: true,
      });
      reassigned += 1;
    }
    return { reassigned, revoked: 0 };
  }

  const revoked = await prisma.branchMember.deleteMany({ where: { branchId } });
  return { reassigned: 0, revoked: revoked.count };
}
